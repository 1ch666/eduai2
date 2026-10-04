// Disposable local accounts only. Never run against production.
import assert from 'node:assert/strict';
import {parseSnapshot,parseEvent} from '../court/protocol.js';
import {CourtReplayLoader} from '../court/replay-loader.js';
import {localApiTarget} from './local-api-target.mjs';
import {assertCourtSchema,courtV2Response} from './court-schema-check.mjs';
const base=localApiTarget(process.argv[2]);
async function call(path,body,auth={},raw){
 const r=await fetch(base+path,{method:body||raw?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Origin:base,...(body||raw?{'Content-Type':'application/json'}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},body:raw??(body?JSON.stringify(body):undefined)});
 const data=await r.json();return {status:r.status,data,cookie:r.headers.getSetCookie().find(s=>s.startsWith('civic_session='))?.split(';')[0],csrf:data.csrfToken};
}
const register=()=>call('/api/auth/register',{username:'v1_'+crypto.randomUUID().slice(0,8),password:'local-test-password-2026',displayName:'本機 v1 測試'});
const a=await register(),b=await register();assert.equal(a.status,201);assert.equal(b.status,201);
const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
// v2 is additive transport around the SAME persisted v1 command/outcome.
{
 const creation={apiVersion:2,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:crypto.randomUUID(),expectedStateVersion:0,config};
 assert.equal((await call('/api/v2/court/sessions',creation)).status,401);
 assert.equal((await call('/api/v2/court/sessions',creation,{cookie:b.cookie})).status,403);
 const created=await Promise.all([call('/api/v2/court/sessions',creation,b),call('/api/v2/court/sessions',creation,b)]);
 for(const r of created){assert.equal(r.status,201);assert.equal(courtV2Response(r.data),true);}
 assert.deepEqual(created[0].data.data,created[1].data.data);
 const id=creation.sessionId,v2='/api/v2/court/sessions/'+id,v1='/api/court/v1/sessions/'+id;
 assert.deepEqual((await call(v2+'/requests/'+creation.requestId,undefined,b)).data.data,created[0].data.data);
 assert.equal((await call('/api/v2/court/sessions',{...creation,idempotencyKey:crypto.randomUUID()},b)).status,409);
 assert.equal((await call('/api/v2/court/sessions',creation,a)).status,404);
 assert.equal((await call('/api/court/sessions',undefined,a)).data.sessions.some(s=>s.id===id),false);
 const get=v2+'?requestId='+crypto.randomUUID();
 for(const [auth,status] of [[{},401],[a,404],[b,200]]){
  const r=await call(get,undefined,auth);assert.equal(r.status,status);assert.equal(courtV2Response(r.data),true,JSON.stringify(courtV2Response.errors));
 }
 const command={apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,caseId:'sale',expectedStateVersion:0,actionId:'acknowledge',targetId:'',text:''};
 assert.equal((await call(v2+'/actions',command,{cookie:b.cookie})).status,403);
 const malformed=await call(v2+'/actions',undefined,b,JSON.stringify(command).replace('"apiVersion":1','"apiVersion":1,"apiVersion":1'));
 assert.equal(malformed.status,400);assert.equal(courtV2Response(malformed.data),true);
 const replies=await Promise.all([call(v2+'/actions',command,b),call(v1+'/actions',command,b)]);
 assert.ok(replies.every(r=>r.status===200));assert.equal(courtV2Response(replies[0].data),true);
 assert.deepEqual(replies[0].data.data,replies[1].data);assert.equal(replies[0].data.stateVersion,1);
 const recovery=await call(v2+'/requests/'+command.requestId,undefined,b);
 assert.equal(courtV2Response(recovery.data),true);assert.deepEqual(recovery.data.data,replies[1].data);
 assert.notEqual(recovery.data.requestId,replies[0].data.requestId,'HTTP IDs are not persisted mutation IDs');
 const stale=await call(v2+'/actions',{...command,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID()},b);
 assert.equal(stale.status,409);assert.equal(courtV2Response(stale.data),true);
 const audit=await call(v2+'/events',undefined,b);assert.equal(audit.status,200);assert.equal(courtV2Response(audit.data),true,JSON.stringify(courtV2Response.errors));
 assert.equal(audit.data.data.events.length,2);assert.equal(audit.data.stateVersion,1);
 assert.equal(audit.data.data.events[0].provenance,'verified-creation-v2');
 assert.equal(audit.data.data.events[0].previousVersion,null);
 assert.equal(audit.data.data.events[0].newVersion,0);
 assert.equal(audit.data.data.events[0].idempotencyKey,creation.idempotencyKey);
 assert.equal(audit.data.data.events[1].previousVersion,0);assert.equal(audit.data.data.events[1].idempotencyKey,command.idempotencyKey);
 assert.deepEqual(audit.data.data.events[1].payload,replies[1].data);
 const empty=await call(v2+'/events?after=1',undefined,b);assert.equal(courtV2Response(empty.data),true);assert.deepEqual(empty.data.data.events,[]);
 assert.equal((await call(v2+'/events',undefined,a)).status,404);
 assert.equal((await call(v2+'/events')).status,401);
 assert.equal((await call(v2+'/events?after=1e0',undefined,b)).status,400);
 assert.equal((await call(v2+'/events',{},b)).status,405);
 assert.equal((await call('/api/court/sessions/'+id+'/events',undefined,b)).data.events.length,2);
 const deletion={...command,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),actionId:'session.delete',expectedStateVersion:1};
 const remove=async(auth,body=deletion)=>{
  const r=await fetch(base+v2,{method:'DELETE',headers:{Origin:base,'Content-Type':'application/json',...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const data=await r.json();assert.equal(courtV2Response(data),true);return {status:r.status,data};
 };
 assert.equal((await remove({})).status,401);
 assert.equal((await remove({cookie:b.cookie})).status,403);
 assert.equal((await remove(a)).status,404);
 assert.equal((await remove(b,{...deletion,expectedStateVersion:0})).status,409);
 const removed=await Promise.all([remove(b),remove(b)]);
 assert.ok(removed.every(r=>r.status===200));assert.deepEqual(removed[0].data.data,removed[1].data.data);
 assert.equal(removed[0].data.stateVersion,2);
 const deletionOutcome=v2+'/requests/'+deletion.requestId;
 assert.equal((await call(deletionOutcome)).status,401);
 assert.equal((await call(deletionOutcome,undefined,a)).status,404);
 const recoveredDeletion=await call(deletionOutcome,undefined,b);
 assert.equal(recoveredDeletion.status,200);assert.equal(courtV2Response(recoveredDeletion.data),true);
 assert.deepEqual(recoveredDeletion.data.data,removed[0].data.data);
 assert.equal((await call(v2+'/requests/'+command.requestId,undefined,b)).status,404);
 assert.equal((await remove(b,{...deletion,idempotencyKey:crypto.randomUUID()})).status,409);
 assert.equal((await call(get,undefined,b)).status,404);
 assert.equal((await call('/api/court/sessions',undefined,b)).data.sessions.some(s=>s.id===id),false);
 assert.equal((await call('/api/court/sessions/'+id+'/delete',{confirm:true},b)).status,200);
 assert.deepEqual((await remove(b)).data.data,removed[0].data.data);
}
// CI runs with AI disabled and no key. Exercise actual Worker -> CourtRoom RPC
// and additive SQLite initialization without an inference or production account.
{
 const auth=b; // Reuse the second fixture; respect the real IP signup quota.
 const scene=await call('/api/court/sessions',config,auth);assert.equal(scene.status,201);
 const root='/api/court/sessions/'+scene.data.view.id;
 assert.equal((await call(root+'/dialogue',{},{})).status,401);
 assert.equal((await call(root+'/dialogue',{},{cookie:auth.cookie})).status,403);
 assert.equal((await call(root+'/dialogue',{},a)).status,404);
 const replies=await Promise.all(Array.from({length:3},()=>call(root+'/dialogue',{},auth)));
 for(const reply of replies){
  assert.equal(reply.status,200);
  const {aiOutcome,...legacy}=reply.data;assert.deepEqual(legacy,scene.data.view.turn);
  assert.deepEqual(aiOutcome,{schemaVersion:1,scope:'response',feature:'stage-dialogue',source:'scripted',mode:'SCRIPTED_AI_FALLBACK',modelUsed:false});
 }
 assert.equal((await call(root,undefined,auth)).data.view.version,0);
 assert.equal((await call(root+'/events',undefined,auth)).data.events.length,1);
 assert.equal((await call(root+'/delete',{confirm:true},auth)).status,200);
 assert.equal((await call(root+'/dialogue',{},auth)).status,404);
}
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
// Fully random case: the server draws the legal config; AI is off here, so it must fall back to the library.
{
 // Reuse b: the local registration budget is shared with the other CI API scripts.
 const c=b;
 const random='/api/court/cases/random',requestId=crypto.randomUUID();
 assert.equal((await call(random,{requestId})).status,401);
 assert.equal((await call(random,{requestId},{cookie:c.cookie})).status,403);
 for(const extra of [{caseId:'injury'},{role:'judge'},{claimantAge:30},{respondentAid:'none'},{procedure:'criminal'}])
  assert.equal((await call(random,{requestId,...extra},c)).status,400,JSON.stringify(extra));
 const created=await call(random,{requestId},c);assert.equal(created.status,201,JSON.stringify(created.data));
 assert.equal(created.data.generation.mode,'library');assert.match(created.data.view.title,/^\[題庫\] /);
 assert.deepEqual((await call(random,{requestId},c)).data.view,created.data.view);
 const id=created.data.view.id;
 assert.equal((await call('/api/court/sessions/'+id,undefined,c)).data.view.title,created.data.view.title);
 assert.equal((await call('/api/court/sessions/'+id,undefined,a)).status,404);
 assert.ok((await call('/api/court/sessions',undefined,c)).data.sessions.some(s=>s.id===id&&s.title===created.data.view.title));
 const snapshot=await call('/api/court/v1/sessions/'+id+'?requestId='+crypto.randomUUID(),undefined,c);
 assert.equal(snapshot.status,200);assert.ok(parseSnapshot(JSON.stringify(snapshot.data)));
 const legacyAction={requestId:crypto.randomUUID(),version:0,type:created.data.view.actions[0]};
 const actionPath='/api/court/sessions/'+id+'/actions';
 const legacyResult=await call(actionPath,legacyAction,c);assert.equal(legacyResult.status,200);
 assert.deepEqual((await call(actionPath,legacyAction,c)).data,legacyResult.data);
 assert.equal((await call(actionPath,{...legacyAction,requestId:crypto.randomUUID()},c)).status,409);
 assert.equal((await call('/api/court/sessions/'+id+'/delete',{confirm:true},c)).status,200);
}
console.log('Local workerd v1 HTTP passed: auth, owner, CSRF, raw duplicate keys, stale version, NPC result/history deduplication, replay, deletion and three concurrent submission scenarios, plus the fully random case route.');
