import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {courtV2Response} from './court-schema-check.mjs';
const bundle=await build({entryPoints:['src/court-v2.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{
 name:'court-handler-fixture',setup(b){b.onResolve({filter:/^\.\/court$/},()=>({path:'court',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const handleCourt=(...args)=>args[1].handler(...args);'}));}
}]});
const {handleCourtV2}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const origin='https://test.example',id=crypto.randomUUID(),path=origin+'/api/v2/court/sessions/'+id;
const trace={schemaVersion:1,requestId:crypto.randomUUID(),traceId:crypto.randomUUID().replaceAll('-','')};
const send=(body,status=200,cookies=[])=>new Response(JSON.stringify(body),{status,headers:{'Cache-Control':'no-store','Set-Cookie':cookies.join(',')}});
const receipt={apiVersion:1,requestId:crypto.randomUUID(),sessionId:id,caseId:'sale',outcome:'not-applied',reason:'expired'};

test('v2 aliases only approved routes, keeps raw commands, cookies, origin, signal and trace',async()=>{
 let calls=0;const raw='{"duplicate":1,"duplicate":2}';
 const request=new Request(path+'/actions',{method:'POST',headers:{Cookie:'PRIVATE','X-CSRF-Token':'PRIVATE','Content-Type':'application/json'},body:raw});
 const response=await handleCourtV2(request,{handler:async(r,_env,respond,trusted,t)=>{
  calls++;assert.equal(new URL(r.url).pathname,'/api/court/v1/sessions/'+id+'/actions');
  assert.equal(await r.text(),raw,'must not JSON.parse/stringify away duplicate keys');
  assert.equal(r.headers.get('Cookie'),'PRIVATE');assert.equal(r.headers.get('X-CSRF-Token'),'PRIVATE');assert.equal(trusted,origin);assert.equal(t,trace);
  return respond(receipt,200,['example=value; HttpOnly']);
 }},send,trace,origin);
 const envelope=await response.json();assert.equal(calls,1);assert.equal(envelope.apiVersion,2);assert.equal(envelope.requestId,trace.requestId);
 assert.equal(envelope.data.requestId,receipt.requestId);assert.deepEqual(envelope.data,receipt);assert.equal(envelope.stateVersion,null);
 assert.equal(courtV2Response(envelope),true,JSON.stringify(courtV2Response.errors));
 assert.equal(response.headers.get('Set-Cookie'),'example=value; HttpOnly');assert.equal(response.headers.get('Cache-Control'),'no-store');
});

test('v2 errors and exceptions use uniform safe metadata without private partial data',async()=>{
 for(const status of [400,401,403,404,405,409,429,500]){
  const r=await handleCourtV2(new Request(path),{handler:async(_r,_e,respond)=>respond({error:'PRIVATE',owner:'PRIVATE',stateVersion:8},status)},send,trace,origin);
  const b=await r.json();assert.equal(r.status,status);assert.equal(b.ok,false);assert.equal(b.data,null);assert.equal(b.stateVersion,null);
  assert.equal(b.errorCode,status===500?'INTERNAL_ERROR':`HTTP_${status}`);assert.equal(courtV2Response(b),true);assert.equal(JSON.stringify(b).includes('PRIVATE'),false);
 }
 let calls=0;const r=await handleCourtV2(new Request(path),{handler:async()=>{calls++;throw Error('PRIVATE');}},send,trace,origin);
 assert.equal(r.status,500);assert.equal(calls,1);assert.equal(courtV2Response(await r.json()),true);
});

test('v2 unknown routes cannot fall through to creation/deletion and preflight does not call the domain',async()=>{
 const env={handler:()=>{throw Error('must not be called');}};
 for(const suffix of ['/delete','/dialogue','/unexpected']){
  const r=await handleCourtV2(new Request(path+suffix),env,send,trace,origin);assert.equal(r.status,404);assert.equal(courtV2Response(await r.json()),true);
 }
 const preflight=await handleCourtV2(new Request(path,{method:'OPTIONS'}),env,send,trace,origin);
 assert.equal(preflight.status,204);assert.equal(await preflight.text(),'');assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
 const denied=await handleCourtV2(new Request(path,{method:'OPTIONS'}),env,send,trace);
 assert.equal(denied.status,403);assert.equal(courtV2Response(await denied.json()),true);
});

test('v2 creation rejects invalid wire before reserving and retains the same IDs on ambiguous RPC failure',async()=>{
 const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
 const c={apiVersion:2,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,expectedStateVersion:0,config};
 let adds=0,inits=0,cleanups=0,fail=true;
 const env={ACCOUNT_STORE:{getByName:()=>({session:async()=>({user:{id:'owner'},csrfToken:'csrf'})})},
  LEARNER:{getByName:()=>({allow:async()=>true,addCourt:async sid=>{assert.equal(sid,id);adds++;return true;},removeCourt:async()=>{cleanups++;}})},
  COURT_ROOM:{getByName:sid=>({initV2:async(owner,input)=>{inits++;assert.equal(owner,'owner');assert.equal(sid,id);assert.deepEqual(JSON.parse(JSON.stringify(input)),c);if(fail)throw Error('lost RPC');return {status:404};}})}};
 const headers={'Content-Type':'application/json',Cookie:'__Host-civic_session='+'a'.repeat(64),'X-CSRF-Token':'csrf'};
 const call=raw=>handleCourtV2(new Request(origin+'/api/v2/court/sessions',{method:'POST',headers,body:raw}),env,send,trace,origin);
 assert.equal((await call(JSON.stringify(c).replace('"apiVersion":2','"apiVersion":2,"apiVersion":2'))).status,400);
 assert.equal((await call(' '.repeat(4097))).status,413);assert.equal(adds,0);assert.equal(inits,0);
 assert.equal((await call(JSON.stringify(c))).status,500);assert.equal(cleanups,0);
 fail=false;assert.equal((await call(JSON.stringify(c))).status,404);assert.equal(cleanups,1);assert.equal(adds,2);assert.equal(inits,2);
});
test('v2 outcome requires login, validates identifiers and never invokes mutation/index cleanup',async()=>{
 const requestId=crypto.randomUUID();let reads=0;
 const env={ACCOUNT_STORE:{getByName:()=>({session:async()=>({user:{id:'owner'}})})},
  COURT_ROOM:{getByName:sessionId=>({outcomeV2:async(owner,sid,rid)=>{
   reads++;assert.equal(owner,'owner');assert.equal(sessionId,id);assert.equal(sid,id);assert.equal(rid,requestId);return {status:404};
  }})}};
 const url=path+'/requests/'+requestId,headers={Cookie:'__Host-civic_session='+'a'.repeat(64)};
 assert.equal((await handleCourtV2(new Request(url),env,send,trace,origin)).status,401);
 assert.equal((await handleCourtV2(new Request(url,{method:'POST',headers}),env,send,trace,origin)).status,405);
 assert.equal((await handleCourtV2(new Request(path+'/requests/'+'0'.repeat(36),{headers}),env,send,trace,origin)).status,400);
 assert.equal(reads,0);
 const r=await handleCourtV2(new Request(url,{headers}),env,send,trace,origin);
 assert.equal(r.status,404);assert.equal(reads,1);assert.equal(courtV2Response(await r.json()),true);
});
test('v2 deletion checks session, CSRF, rate and strict command before RPC, and retries index cleanup',async()=>{
 const command={apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,caseId:'sale',expectedStateVersion:0,actionId:'session.delete',targetId:'',text:''};
 const deleted={apiVersion:2,requestId:command.requestId,idempotencyKey:command.idempotencyKey,sessionId:id,eventId:crypto.randomUUID(),previousVersion:0,stateVersion:1,timestamp:new Date().toISOString(),outcome:'deleted'};
 let deletes=0,cleanups=0,failCleanup=true,allowed=true;
 const env={ACCOUNT_STORE:{getByName:()=>({session:async()=>({user:{id:'owner'},csrfToken:'csrf'})})},
  LEARNER:{getByName:()=>({allow:async()=>allowed,removeCourt:async()=>{cleanups++;if(failCleanup)throw Error('private index failure');}})},
  COURT_ROOM:{getByName:sessionId=>({removeV2:async(owner,m)=>{deletes++;assert.equal(owner,'owner');assert.equal(sessionId,id);assert.deepEqual(m,command);return deleted;}})}};
 const headers={'Content-Type':'application/json',Cookie:'__Host-civic_session='+'a'.repeat(64),'X-CSRF-Token':'csrf'};
 const call=(body=JSON.stringify(command),h=headers,trusted=origin)=>handleCourtV2(new Request(path,{method:'DELETE',headers:h,body}),env,send,trace,trusted);
 assert.equal((await call(undefined,{'Content-Type':'application/json'})).status,401);
 assert.equal((await call(undefined,{...headers,'X-CSRF-Token':'wrong'})).status,403);
 assert.equal((await call(undefined,headers,'')).status,403);
 allowed=false;assert.equal((await call()).status,429);allowed=true;
 assert.equal((await call(undefined,{...headers,'Content-Type':'text/plain'})).status,415);
 assert.equal((await call(' '.repeat(8193))).status,413);
 for(const raw of [JSON.stringify({...command,text:'not empty'}),JSON.stringify({...command,sessionId:crypto.randomUUID()}),JSON.stringify(command).replace('"apiVersion":1','"apiVersion":1,"apiVersion":1')])assert.equal((await call(raw)).status,400);
 assert.equal(deletes,0);assert.equal(cleanups,0);
 const failed=await call();assert.equal(failed.status,500);assert.equal((await failed.json()).data,null);
 failCleanup=false;const retry=await call(),body=await retry.json();assert.equal(retry.status,200);
 assert.deepEqual(body.data,deleted);assert.equal(courtV2Response(body),true);assert.equal(body.stateVersion,1);
 assert.equal(cleanups,2);assert.equal(deletes,2);
});
