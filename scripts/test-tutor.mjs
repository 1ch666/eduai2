import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle=await build({entryPoints:['src/ai.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{
 name:'local-rate-limit-stub',setup(b){
  b.onResolve({filter:/^\.\/messages$/},()=>({path:'messages',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function messageRoom(env){return env.testRoom}'}));
 }
}]});
const {handleAiRequest}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const env={OLLAMA_API_KEY:'test-secret-not-real',testRoom:{allowAiRequest:async()=>true}};
const respond=(body,status=200)=>Response.json(body,{status});
function ask(){return handleAiRequest(new Request('https://local.test/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'說明權力分立的優點',history:[],clientId:'local-test-client-0001',requestId:crypto.randomUUID()})}),env,respond);}
test('tutor uses supported gpt-oss thinking level and returns only final answer',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(_url,options)=>{
   const body=JSON.parse(options.body);assert.equal(body.think,'low');assert.equal(body.options.num_predict,2048);
   assert.equal(body.stream,false);assert.equal(body.format,undefined);
   return Response.json({message:{content:'權力分立可避免權力過度集中。',thinking:'private reasoning'}});
  };
  const r=await ask();assert.equal(r.status,200);assert.equal((await r.json()).answer,'權力分立可避免權力過度集中。');
 }finally{globalThis.fetch=old;}
});
test('tutor distinguishes empty, truncated, malformed, oversized and HTTP errors without exposing reasoning',async()=>{
 const old=globalThis.fetch,oldWarn=console.warn,oldError=console.error;const logs=[];
 console.warn=console.error=x=>logs.push(x);
 try{
  const cases=[
   [()=>Response.json({message:{thinking:'private reasoning',content:''}}),'EMPTY_CONTENT'],
   [()=>Response.json({done_reason:'length',message:{content:'partial'}}),'OUTPUT_TRUNCATED'],
   [()=>new Response('not json'),'RESPONSE_FORMAT'],
   [()=>new Response('x'.repeat(65537)),'RESPONSE_TOO_LARGE'],
   [()=>new Response('',{status:401}),'PROVIDER_AUTH'],
   [()=>new Response('',{status:404}),'MODEL_NOT_FOUND'],
   [()=>new Response('',{status:429}),'QUOTA'],
   [()=>{throw new DOMException('timeout','TimeoutError')},'TIMEOUT'],
   [()=>{throw new TypeError('network')},'NETWORK']
  ];
  for(const [reply,code] of cases){globalThis.fetch=async()=>reply();const r=await ask();assert.ok(r.status>=400);const p=await r.json();assert.equal(p.code,code);assert.equal(p.answer,undefined);assert.ok(!JSON.stringify(p).includes('private reasoning'));}
  assert.ok(!logs.join('').includes('test-secret'));assert.ok(!logs.join('').includes('權力分立'));assert.ok(!logs.join('').includes('private reasoning'));
 }finally{globalThis.fetch=old;console.warn=oldWarn;console.error=oldError;}
});
