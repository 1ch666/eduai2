import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['src/providers/ollama.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {createOllamaProvider}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const input={messages:[{role:'user',content:'民主'}],maxOutputTokens:512,temperature:.2,output:'text'};
const make=raw=>createOllamaProvider({apiKey:'test-only',model:'gpt-oss:20b'},async(_url,options)=>{
  assert.equal(options.redirect,'manual');assert.equal(JSON.parse(options.body).stream,true);
  const bytes=new TextEncoder().encode(raw);
  return new Response(new ReadableStream({start(c){for(const b of bytes)c.enqueue(new Uint8Array([b]));c.close();}}));
});
test('streams real text across UTF8 boundaries without exposing thinking',async()=>{
  const received=[];
  const result=await make('{"done":false,"message":{"thinking":"secret","content":"民"}}\n{"done":true,"message":{"content":"主"},"eval_count":2}\n').generate(input,{timeoutMs:1000,onText:async t=>{received.push(t);}});
  assert.equal(result.ok,true);assert.equal(result.value.text,'民主');assert.deepEqual(received,['民','主']);
});
test('truncated NDJSON never becomes a successful answer',async()=>{
  const result=await make('{"done":false,"message":{"content":"未完成"}}\n').generate(input,{timeoutMs:1000,onText:async()=>{}});
  assert.equal(result.ok,false);assert.equal(result.code,'RESPONSE_FORMAT');
});
test('output cap and provider truncation fail closed',async()=>{
  for(const raw of ['{"done":true,"done_reason":"length","message":{"content":"partial"}}\n',JSON.stringify({done:true,message:{content:'a'.repeat(5001)}})+'\n']){
    const result=await make(raw).generate(input,{timeoutMs:1000,onText:async()=>{}});
    assert.equal(result.ok,false);
  }
});
