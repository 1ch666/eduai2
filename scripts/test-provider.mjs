import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/providers/ollama.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {createOllamaProvider}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const input={messages:[{role:'user',content:'private question'}],maxOutputTokens:512,temperature:.2,output:'text'};
const ctx={timeoutMs:1000};
const provider=fetcher=>createOllamaProvider({apiKey:'fake-private-key',model:'gpt-oss:20b'},fetcher);

test('provider projects only final text and reported usage; uses fixed endpoint without redirects',async()=>{
  let count=0;
  const p=provider(async(url,options)=>{
    count++;assert.equal(url,'https://ollama.com/api/chat');assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,'Bearer fake-private-key');
    const body=JSON.parse(options.body);assert.equal(body.think,'low');assert.equal(body.stream,false);
    assert.equal(body.options.num_predict,512);assert.equal(body.format,undefined);
    return Response.json({message:{content:' answer ',thinking:'hidden'},prompt_eval_count:17,eval_count:5});
  });
  assert.deepEqual(await p.generate(input,ctx),{ok:true,value:{text:'answer',usage:{inputTokens:17,outputTokens:5}}});
  assert.equal(count,1);assert.equal(JSON.stringify(p).includes('fake-private-key'),false);
});

test('provider does not start work for missing credentials, malformed bounds or already cancelled input',async()=>{
  let count=0;const transport=async()=>{count++;throw new Error('must not call');};
  const noKey=createOllamaProvider({model:'gpt-oss:20b'},transport);
  assert.equal((await noKey.generate(input,ctx)).code,'NOT_CONFIGURED');
  for(const bad of [{...input,maxOutputTokens:0},{...input,temperature:NaN},{...input,messages:[]},
    {...input,messages:[{role:'tool',content:'x'}]},{...input,messages:[{role:'user',content:'x'.repeat(32769)}]}]){
    assert.equal((await provider(transport).generate(bad,ctx)).code,'INVALID_INPUT');
  }
  assert.equal((await provider(transport).generate(input,{timeoutMs:60001})).code,'INVALID_INPUT');
  assert.equal((await provider(transport).generate(input,{...ctx,signal:AbortSignal.abort()})).code,'CANCELLED');
  assert.equal(count,0);
});

test('quota, authorization, network and malformed output have stable errors, no retry and no private data',async()=>{
  for(const [reply,code] of [
    [()=>new Response('private',{status:429}),'QUOTA'],
    [()=>new Response('private',{status:403}),'PROVIDER_AUTH'],
    [()=>new Response('private',{status:404}),'MODEL_NOT_FOUND'],
    [()=>new Response('private',{status:503}),'UPSTREAM'],
    [()=>{throw new Error('fake-private-key')},'NETWORK'],
    [()=>new Response('not JSON'),'RESPONSE_FORMAT'],
    [()=>new Response(new Uint8Array([0xff])),'INVALID_ENCODING'],
    [()=>Response.json({message:{content:'',thinking:'hidden'}}),'EMPTY_CONTENT'],
    [()=>Response.json({done_reason:'length',message:{content:'partial'}}),'OUTPUT_TRUNCATED']
  ]){
    let calls=0;const result=await provider(async()=>{calls++;return reply();}).generate(input,ctx);
    assert.deepEqual(result,{ok:false,code});assert.equal(calls,1);
  }
});

test('oversized streams are cancelled and invalid usage is unknown rather than fabricated',async()=>{
  let cancelled=false;
  const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(65537));},cancel(){cancelled=true;}});
  assert.deepEqual(await provider(async()=>new Response(stream)).generate(input,ctx),{ok:false,code:'RESPONSE_TOO_LARGE'});
  assert.equal(cancelled,true);
  const result=await provider(async()=>Response.json({message:{content:'x'},prompt_eval_count:-1,eval_count:'5'})).generate(input,ctx);
  assert.deepEqual(result.value.usage,{inputTokens:null,outputTokens:null});
});

test('cancellation aborts in-flight transport without a second request',async()=>{
  const controller=new AbortController();let entered;const started=new Promise(r=>entered=r);let count=0;
  const p=provider(async(_url,{signal})=>{count++;entered();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
  const pending=p.generate(input,{...ctx,signal:controller.signal});
  await started;controller.abort(new Error('private cancellation reason'));
  assert.deepEqual(await pending,{ok:false,code:'CANCELLED'});assert.equal(count,1);
});

test('body-phase cancellation and timeout remain failures, not partial final answers',async()=>{
  const controller=new AbortController();let entered;const ready=new Promise(r=>entered=r);
  const p=provider(async(_url,{signal})=>new Response(new ReadableStream({start(c){
    c.enqueue(new TextEncoder().encode('{"message":{"content":"partial'));
    signal.addEventListener('abort',()=>c.error(signal.reason),{once:true});entered();
  }})));
  const pending=p.generate(input,{...ctx,signal:controller.signal});await ready;controller.abort();
  assert.deepEqual(await pending,{ok:false,code:'CANCELLED'});
  const timeout=provider(async()=>new Response(new ReadableStream({start(c){c.error(new DOMException('private','TimeoutError'));}})));
  assert.deepEqual(await timeout.generate(input,ctx),{ok:false,code:'TIMEOUT'});
});

test('JSON mode and non-gpt models are adapter concerns; extra message fields never leave the adapter',async()=>{
  const p=createOllamaProvider({apiKey:'fake',model:'other-existing-model'},async(_url,options)=>{
    const b=JSON.parse(options.body);assert.equal(b.think,false);assert.equal(b.format,'json');
    assert.deepEqual(b.messages,[{role:'user',content:'question'}]);
    return Response.json({message:{content:'{"proposal":true}'}});
  });
  const result=await p.generate({...input,output:'json',messages:[{role:'user',content:'question',secret:'never forward'}]},ctx);
  assert.equal(result.ok,true);assert.equal(result.value.text,'{"proposal":true}');
});
