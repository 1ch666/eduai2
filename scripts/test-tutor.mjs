import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import {gzipSync} from 'node:zlib';
import {grantedAdmission,studyFixture} from './helpers/study-fixture.mjs';
const bundle=await build({entryPoints:['src/ai.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{
 name:'local-rate-limit-stub',setup(b){
  b.onResolve({filter:/^\.\/messages$/},()=>({path:'messages',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function messageRoom(env){return env.testRoom}'}));
 }
}]});
const {handleAiRequest}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const env={OLLAMA_API_KEY:'test-secret-not-real',testRoom:{allowAiRequest:async()=>true},
 LEARNER:{getByName:()=>({reserveStudyAi:async()=>({code:'RESERVED',issuedAt:Date.now()})})},AI_ADMISSION:grantedAdmission()};
const respond=(body,status=200)=>Response.json(body,{status});
function ask(question='說明權力分立的優點',configuration=env){return handleAiRequest(new Request('https://local.test/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,history:[],clientId:'local-test-client-0001',requestId:crypto.randomUUID(),aiOutcome:{mode:'FULL'}})}),configuration,respond);}

test('exact dictionary lookup stays NO_AI, not RAG, even with a caller-forged outcome',async()=>{
 const entry={word:'民主',version:'synthetic-test',source_url:'https://example.invalid',readings:[{pronunciation:{bopomofo:'',pinyin:''},definitions:['測試詞義']}]};
 const configuration={...env,OLLAMA_API_KEY:'',ASSETS:{fetch:async()=>new Response(gzipSync(JSON.stringify(entry)+'\n'))},
  LEARNER:{getByName(){throw Error('dictionary must not reserve inference');}}};
 const response=await ask('民主是什麼',configuration);assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.provider,'MOE dictionary');assert.equal(body.aiOutcome.source,'dictionary');
 assert.equal(body.aiOutcome.mode,'NO_AI');assert.equal(body.aiOutcome.modelUsed,false);
 const absent=await ask('說明權力分立的優點',{...configuration,ASSETS:undefined});
 assert.equal(absent.status,503);assert.equal((await absent.json()).aiOutcome.source,'none');
});
test('tutor uses supported gpt-oss thinking level and returns only final answer',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(_url,options)=>{
   const body=JSON.parse(options.body);assert.equal(body.think,'low');assert.equal(body.options.num_predict,2048);
   assert.equal(body.stream,false);assert.equal(body.format,undefined);
   return Response.json({message:{content:'權力分立可避免權力過度集中。',thinking:'private reasoning'}});
  };
  const r=await ask();assert.equal(r.status,200);const result=await r.json();assert.equal(result.answer,'權力分立可避免權力過度集中。');assert.equal(result.aiOutcome.mode,'FULL');assert.equal(result.aiOutcome.scope,'response');
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
  for(const [reply,code] of cases){globalThis.fetch=async()=>reply();const r=await ask();assert.ok(r.status>=400);const p=await r.json();assert.equal(p.code,code);assert.equal(p.answer,undefined);assert.equal(p.aiOutcome.mode,'NO_AI');assert.equal(p.aiOutcome.modelUsed,false);assert.ok(!JSON.stringify(p).includes('private reasoning'));}
  assert.ok(!logs.join('').includes('test-secret'));assert.ok(!logs.join('').includes('權力分立'));assert.ok(!logs.join('').includes('private reasoning'));
 }finally{globalThis.fetch=old;console.warn=oldWarn;console.error=oldError;}
});
test('tutor concurrent duplicate and changed text cannot spend again; clientId cannot split guest budget',async()=>{
 const f=studyFixture(),old=globalThis.fetch;let calls=0,release,entered;const ready=new Promise(r=>entered=r),owners=[];
 const configured={...env,LEARNER:{getByName(o){owners.push(o);return f;}}};
 const body={question:'說明權力分立的優點',history:[],clientId:'local-test-client-0001',requestId:crypto.randomUUID()};
 const send=(extra={})=>handleAiRequest(new Request('https://local.test/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({...body,...extra})}),configured,respond);
 globalThis.fetch=async()=>{calls++;entered();return new Promise(r=>release=r);};
 try{
  const first=send();await ready;
  assert.equal((await send()).status,409);
  const changed=await send({question:'另一題'});assert.equal((await changed.json()).code,'AI_REQUEST_CONFLICT');
  assert.equal((await send({clientId:'another-client-00002'})).status,409);
  release(Response.json({message:{content:'回答'}}));assert.equal((await first).status,200);
  assert.equal((await send()).status,409);assert.equal(calls,1);
  assert.equal(new Set(owners).size,1);assert.ok(owners[0].startsWith('guest:'));assert.ok(!owners[0].includes('192.0.2.1'));
 }finally{globalThis.fetch=old;f.db.close();}
});
