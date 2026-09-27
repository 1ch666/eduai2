// Disposable local accounts only. Never run against production.
import assert from 'node:assert/strict';
import {parseSnapshot,parseEvent} from '../court/protocol.js';
import {CourtReplayLoader} from '../court/replay-loader.js';
import {localApiTarget} from './local-api-target.mjs';
import {assertCourtSchema} from './court-schema-check.mjs';
const base=localApiTarget(process.argv[2]);
async function call(path,body,auth={},raw){
 const r=await fetch(base+path,{method:body||raw?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Origin:base,...(body||raw?{'Content-Type':'application/json'}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},body:raw??(body?JSON.stringify(body):undefined)});
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
assertCourtSchema('snapshot',initial.data);
const m={apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,caseId:'sale',expectedStateVersion:0,actionId:'acknowledge',targetId:'',text:''};
assertCourtSchema('mutation',m);
assert.equal((await call(path+'/actions',m,{cookie:a.cookie})).status,403);
assert.equal((await call(path+'/actions',m,b)).status,404);
assert.equal((await call(path+'/actions',{...m,score:100},a)).status,400);
assert.equal((await call(path+'/actions',undefined,a,JSON.stringify(m).replace('"apiVersion":1','"apiVersion":1,"apiVersion":1'))).status,400);
const success=await call(path+'/actions',m,a);assert.equal(success.status,200);assert.ok(parseEvent(JSON.stringify(success.data)));
assertCourtSchema('event',success.data);
assert.deepEqual((await call(path+'/actions',m,a)).data,success.data);
assert.equal((await call(path+'/actions',{...m,requestId:crypto.randomUUID()},a)).status,409);
assert.equal((await call(path+'/actions',{...m,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID()},a)).status,409);
assert.deepEqual((await call(path+'/requests/'+m.requestId,undefined,a)).data,success.data);
assert.equal((await call(path+'/requests/'+m.requestId,undefined,b)).status,404);
const history=await call('/api/court/sessions/'+id+'/events',undefined,a);assert.equal(history.status,200);assert.equal(history.data.events.length,2);
assertCourtSchema('eventPage',history.data);
for(const e of history.data.events)assert.ok(parseEvent(JSON.stringify(e)));
const replay=new CourtReplayLoader({origin:base,fetchImpl:(url,options)=>fetch(url,{...options,redirect:'error',headers:{...options.headers,Cookie:a.cookie}})});
replay.bind(id,'sale');assert.equal(await replay.next(),'caught-up');assert.equal(replay.replay.length,2);
assert.equal(replay.replay.step(),true);assert.equal(replay.replay.current.stateVersion,1);
replay.replay.seek(0);assert.equal(replay.replay.current.stateVersion,0);
assert.deepEqual((await call(path+'/requests/'+m.requestId,undefined,a)).data,success.data);
replay.clear();assert.equal(replay.replay.current,null);
const question={...m,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),expectedStateVersion:1,actionId:'npc.ask',targetId:'Witness',text:'你好，請介紹你的角色。'};
assert.equal((await call(path+'/actions',question,{cookie:a.cookie})).status,403);
assert.equal((await call(path+'/actions',question,b)).status,404);
const npc=await call(path+'/actions',question,a);assert.equal(npc.status,200);assert.ok(parseEvent(JSON.stringify(npc.data)));
assertCourtSchema('event',npc.data);
assert.equal(npc.data.kind,'npc_utterance');assert.equal(npc.data.stateVersion,2);
assert.deepEqual((await call(path+'/actions',question,a)).data,npc.data);
assert.deepEqual((await call(path+'/requests/'+question.requestId,undefined,a)).data,npc.data);
assert.equal((await call('/api/court/sessions/'+id+'/events',undefined,a)).data.events.length,3);
const legacy=await call('/api/court/sessions/'+id,undefined,a);
assert.equal(legacy.data.view.npcHistory.filter(r=>r.requestId===question.requestId).length,1);
const deletion='/api/court/sessions/'+id+'/delete';
assert.equal((await call(deletion,{confirm:true},{cookie:a.cookie})).status,403);
assert.equal((await call(deletion,{confirm:true},b)).status,404);
assert.equal((await call(deletion,{confirm:false},a)).status,400);
assert.equal((await call(deletion,{confirm:true},a)).status,200);
assert.equal((await call(deletion,{confirm:true},a)).status,200);
assert.equal((await call('/api/court/sessions/'+id,undefined,a)).status,404);
assert.ok(!(await call('/api/court/sessions',undefined,a)).data.sessions.some(s=>s.id===id));
// Launch together, without timing sleeps or assuming which request wins. Real
// local workerd/SQLite handles the requests; no mocked storage or production data.
for(const mode of ['duplicate','competing-version','reused-key']){
 const fresh=await call('/api/court/sessions',config,a);assert.equal(fresh.status,201);
 const sessionId=fresh.data.view.id,route='/api/court/v1/sessions/'+sessionId;
 const command={...m,sessionId,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID()};
 const commands=mode==='duplicate'?Array.from({length:4},()=>({...command})):
  [command,{...command,requestId:crypto.randomUUID(),idempotencyKey:mode==='reused-key'?command.idempotencyKey:crypto.randomUUID()}];
 const responses=await Promise.all(commands.map(c=>call(route+'/actions',c,a)));
 assert.deepEqual(responses.map(r=>r.status).sort(),mode==='duplicate'?[200,200,200,200]:[200,409],mode);
 const winner=responses.find(r=>r.status===200).data;
 assertCourtSchema('event',winner);assert.equal(winner.stateVersion,1);
 for(let i=0;i<responses.length;i++){
  if(responses[i].status===200){
   assert.deepEqual(responses[i].data,winner);
   const recovered=await call(route+'/requests/'+commands[i].requestId,undefined,a);
   assert.equal(recovered.status,200);assert.deepEqual(recovered.data,winner);
  }
 }
 const snapshot=await call(route+'?requestId='+crypto.randomUUID(),undefined,a);
 assert.equal(snapshot.status,200);assertCourtSchema('snapshot',snapshot.data);
 assert.equal(snapshot.data.stateVersion,1,mode+' must commit only once');
 const events=await call('/api/court/sessions/'+sessionId+'/events',undefined,a);
 assert.equal(events.status,200);assertCourtSchema('eventPage',events.data);
 assert.equal(events.data.events.length,2,mode+' must append only one mutation');
 assert.deepEqual(events.data.events[1],winner);
 assert.equal((await call(route,undefined,b)).status,404);
 assert.equal((await call('/api/court/sessions/'+sessionId+'/delete',{confirm:true},a)).status,200);
}
console.log('Local workerd v1 HTTP passed: auth, owner, CSRF, raw duplicate keys, stale version, NPC result/history deduplication, replay, deletion and three concurrent submission scenarios.');
