// Disposable local accounts only. Never run against production.
import assert from 'node:assert/strict';
import {parseSnapshot,parseEvent} from '../court/protocol.js';
import {CourtReplayLoader} from '../court/replay-loader.js';
const base=process.argv[2];assert.ok(base&&['127.0.0.1','localhost'].includes(new URL(base).hostname));
async function call(path,body,auth={},raw){
 const r=await fetch(base+path,{method:body||raw?'POST':'GET',signal:AbortSignal.timeout(20000),headers:{Origin:base,...(body||raw?{'Content-Type':'application/json'}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},body:raw??(body?JSON.stringify(body):undefined)});
 const data=await r.json();return {status:r.status,data,cookie:r.headers.getSetCookie().find(s=>s.startsWith('civic_session='))?.split(';')[0],csrf:data.csrfToken};
}
const register=()=>call('/api/auth/register',{username:'v1_'+crypto.randomUUID().slice(0,8),password:'local-test-password-2026',displayName:'本機 v1 測試'});
const a=await register(),b=await register();assert.equal(a.status,201);assert.equal(b.status,201);
const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
const created=await call('/api/court/sessions',config,a);assert.equal(created.status,201);
const id=created.data.view.id,path='/api/court/v1/sessions/'+id,requestId=crypto.randomUUID();
assert.equal((await call(path+'?requestId='+requestId)).status,401);
assert.equal((await call(path+'?requestId='+requestId,undefined,b)).status,404);
const initial=await call(path+'?requestId='+requestId,undefined,a);assert.equal(initial.status,200);assert.ok(parseSnapshot(JSON.stringify(initial.data)));assert.equal(initial.data.requestId,requestId);
const m={apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,caseId:'sale',expectedStateVersion:0,actionId:'acknowledge',targetId:'',text:''};
assert.equal((await call(path+'/actions',m,{cookie:a.cookie})).status,403);
assert.equal((await call(path+'/actions',m,b)).status,404);
assert.equal((await call(path+'/actions',{...m,score:100},a)).status,400);
assert.equal((await call(path+'/actions',undefined,a,JSON.stringify(m).replace('"apiVersion":1','"apiVersion":1,"apiVersion":1'))).status,400);
const success=await call(path+'/actions',m,a);assert.equal(success.status,200);assert.ok(parseEvent(JSON.stringify(success.data)));
assert.deepEqual((await call(path+'/actions',m,a)).data,success.data);
assert.equal((await call(path+'/actions',{...m,requestId:crypto.randomUUID()},a)).status,409);
assert.equal((await call(path+'/actions',{...m,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID()},a)).status,409);
assert.deepEqual((await call(path+'/requests/'+m.requestId,undefined,a)).data,success.data);
assert.equal((await call(path+'/requests/'+m.requestId,undefined,b)).status,404);
const history=await call('/api/court/sessions/'+id+'/events',undefined,a);assert.equal(history.status,200);assert.equal(history.data.events.length,2);
for(const e of history.data.events)assert.ok(parseEvent(JSON.stringify(e)));
const replay=new CourtReplayLoader({origin:base,fetchImpl:(url,options)=>fetch(url,{...options,headers:{...options.headers,Cookie:a.cookie}})});
replay.bind(id,'sale');assert.equal(await replay.next(),'caught-up');assert.equal(replay.replay.length,2);
assert.equal(replay.replay.step(),true);assert.equal(replay.replay.current.stateVersion,1);
replay.replay.seek(0);assert.equal(replay.replay.current.stateVersion,0);
assert.deepEqual((await call(path+'/requests/'+m.requestId,undefined,a)).data,success.data);
replay.clear();assert.equal(replay.replay.current,null);
console.log('Local workerd v1 HTTP passed: auth, owner, CSRF, raw duplicate keys, stale version, stable result and journal deduplication.');
