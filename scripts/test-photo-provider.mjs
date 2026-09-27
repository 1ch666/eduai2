import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({entryPoints:['src/photo.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {handlePhoto}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const respond=(body,status=200)=>Response.json(body,{status});
const session={user:{id:'user'},csrfToken:'test-csrf'};
const env={ACCOUNT_STORE:{getByName:()=>({session:async()=>session})},LEARNER:{getByName:()=>({allow:async()=>true})}};
const request=(body={text:'民主是什麼',requestId:crypto.randomUUID()},headers={})=>new Request('https://local.test/api/photo/explain',{method:'POST',headers:{'content-type':'application/json',cookie:'__Host-civic_session='+'a'.repeat(64),'x-csrf-token':'test-csrf',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
test('default adapter retains model parameters and rejects oversized or truncated output',async()=>{
 const old=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(url,init)=>{calls++;const wire=JSON.parse(init.body);assert.equal(wire.think,false);assert.equal(wire.options.num_predict,700);assert.equal(wire.format,undefined);assert.equal(init.redirect,'error');return Response.json({message:{content:'民主的核心是人民參與。'}});};
  const configured={...env,OLLAMA_API_KEY:'offline-not-real'};
  assert.equal((await handlePhoto(request(),configured,respond,'trusted')).status,200);assert.equal(calls,1);
  globalThis.fetch=async()=>new Response('x'.repeat(65537));
  assert.equal((await handlePhoto(request(),configured,respond,'trusted')).status,502);
  globalThis.fetch=async()=>Response.json({done_reason:'length',message:{content:'不完整'}});
  const r=await handlePhoto(request(),configured,respond,'trusted');assert.equal(r.status,502);assert.equal((await r.json()).explanation,undefined);
 }finally{globalThis.fetch=old;}
});
test('photo route projects confirmed text, preserves bounds, returns only explanation',async()=>{
 let calls=0;const r=await handlePhoto(request({text:' 民主是什麼 ',requestId:crypto.randomUUID(),images:['PRIVATE_IMAGE'],model:'attacker'}),env,respond,'https://local.test',{async generate(input,context){
  calls++;assert.equal(input.output,'text');assert.equal(input.maxOutputTokens,700);assert.equal(input.temperature,.2);
  assert.equal(context.timeoutMs,30000);assert.equal(context.maxResponseBytes,65536);assert.ok(context.signal);
  assert.equal(input.messages[1].content,'題目文字：\n民主是什麼');assert.ok(!JSON.stringify(input).includes('PRIVATE_IMAGE'));
  return {ok:true,value:{text:'答'.repeat(2100),thinking:'PRIVATE'}};
 }});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{explanation:'答'.repeat(2000)});assert.equal(calls,1);
});
test('origin, login, CSRF, rate and malformed bodies stop before inference',async()=>{
 let calls=0;const p={async generate(){calls++;throw Error('must not call');}};
 for(const [req,e,origin,status] of [
  [request(),env,undefined,403],
  [request({}, {cookie:''}),env,'trusted',401],
  [request({}, {'x-csrf-token':'wrong'}),env,'trusted',403],
  [request(),{...env,LEARNER:{getByName:()=>({allow:async()=>false})}},'trusted',429],
  [request({}, {'content-type':'text/plain'}),env,'trusted',415],
  [request('x'.repeat(4097)),env,'trusted',413],
  [request('bad JSON'),env,'trusted',400],
  [request({text:'x'.repeat(1001),requestId:crypto.randomUUID()}),env,'trusted',400],
  [request({text:'民主',requestId:'bad'}),env,'trusted',400]]){
   assert.equal((await handlePhoto(req,e,respond,origin,p)).status,status);
 }assert.equal(calls,0);
});
test('provider failure codes and exceptions are sanitized without retry',async()=>{
 for(const code of ['QUOTA','NETWORK','TIMEOUT','CANCELLED','OUTPUT_TRUNCATED','EMPTY_CONTENT','RESPONSE_FORMAT','PROVIDER_AUTH']){
  let calls=0;const r=await handlePhoto(request(),env,respond,'trusted',{async generate(){calls++;return {ok:false,code,private:'PRIVATE'};}});
  assert.equal(r.status,code==='QUOTA'?429:502);assert.ok(!JSON.stringify(await r.json()).includes('PRIVATE'));assert.equal(calls,1);
 }
 const r=await handlePhoto(request(),env,respond,'trusted',{async generate(){throw Error('PRIVATE_KEY');}});
 assert.equal(r.status,502);assert.ok(!JSON.stringify(await r.json()).includes('PRIVATE'));
});
