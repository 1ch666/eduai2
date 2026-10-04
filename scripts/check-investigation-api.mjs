// Real loopback Worker -> Durable Object RPC/SQLite; synthetic accounts only.
// This is NOT a browser/Unity test or an educational participant experiment.
import assert from 'node:assert/strict';
import {localApiTarget} from './local-api-target.mjs';
import {parseEvent,parseSnapshot} from '../court/protocol.js';
import {CourtClientState} from '../court/client-state.js';
import {CourtReplay} from '../court/replay.js';
import {PROCEDURAL_REQUESTS} from '../src/court-rules.ts';
const base=localApiTarget(process.argv[2]),caseId='tablet-time-discrepancy-v1';
async function call(path,body,auth={}){
 for(let attempt=0;attempt<2;attempt++){
 const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(20000),
  headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json();
 // This specific 429 is emitted before any court mutation. Keep the exact
 // request/receipt identity; never retry timeouts, uncertain writes or AI calls.
 // Use the real limit, not a test-only auth/rate bypass. CI has a 10-minute cap.
 if(attempt===0&&r.status===429&&data.error==='操作太頻繁，請稍候'){
  console.log('Court rate window reached; waiting for its next minute without changing limits.');
  await new Promise(resolve=>setTimeout(resolve,60000-Date.now()%60000+100));continue;
 }
 return {status:r.status,data,cookie:r.headers.getSetCookie().find(s=>s.startsWith('civic_session='))?.split(';')[0],csrf:data.csrfToken};
 }
}
assert.equal((await call('/api/capabilities')).data.npcAi,false,'Use local Worker with NPC AI disabled');
const register=()=>call('/api/auth/register',{username:'invest_'+crypto.randomUUID().slice(0,8),password:crypto.randomUUID(),displayName:'本機調查驗證'});
const owner=await register(),other=await register();assert.equal(owner.status,201);assert.equal(other.status,201);
// Six creations remain inside the real per-account creation limit. Do not
// disable rate limits or reuse a production account to make this suite pass.
const config=role=>({caseId,role,claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,
 claimantAid:role==='claimantCounsel'?'private':'none',respondentAid:role==='respondentCounsel'?'private':'none'});
for(const role of ['judge','claimant','respondent','claimantCounsel','respondentCounsel','observer']){
const created=await call('/api/court/sessions',config(role),owner);
assert.equal(created.status,201);const id=created.data.view.id,path='/api/court/v1/sessions/'+id,legacy='/api/court/sessions/'+id;
let version=0;
const client=new CourtClientState(),generation=client.bind(id,caseId);
const command=(actionId,text='')=>({apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,caseId,expectedStateVersion:version,actionId,targetId:'',text});
async function act(actionId,text=''){
 assert(client.snapshot.state.allowedActions.some(a=>a.actionId===actionId&&a.enabled),role+': missing published action '+actionId);
 const m=command(actionId,text),result=await call(path+'/actions',m,owner);
 assert.equal(result.status,200,actionId);assert.ok(parseEvent(JSON.stringify(result.data)));assert.equal(result.data.snapshot.stateVersion,version+1);
 assert.equal(client.acceptEvent(JSON.stringify(result.data),generation),'accepted',role+': client must accept actual server event');
 version++;return {m,event:result.data};
}
async function view(){const r=await call(legacy,undefined,owner);assert.equal(r.status,200);return r.data.view;}
async function rejected(actionId,status=409,auth=owner){
 const before=await view(),m=command(actionId),result=await call(path+'/actions',m,auth);
 assert.equal(result.status,status,role+': reject '+actionId);assert.deepEqual(await view(),before,'Rejected action cannot change persisted state');
}
async function review(completed){
 const replay=new CourtReplay();replay.bind(id,caseId);const all=[];
 for(let page=0;page<10;page++){
  const response=await call(legacy+'/events?after='+replay.nextAfter,undefined,owner);assert.equal(response.status,200);
  assert.equal(response.data.currentVersion,version);
  assert.equal(replay.append(response.data.events.map(e=>JSON.stringify(e))),'accepted');
  all.push(...response.data.events);
  assert.equal(response.data.nextAfter,replay.nextAfter);
  if(replay.nextAfter===version)break;
 }
 assert.equal(replay.nextAfter,version);assert.equal(replay.length,version+1);assert.equal(replay.incompletePrefix,false);
 assert.equal(new Set(all.map(e=>e.eventId)).size,all.length);
 assert.equal((await call(legacy+'/events',undefined,other)).status,404);
 for(let i=0;i<replay.length;i++){
  assert(replay.seek(i));assert.equal(replay.current.stateVersion,i);assert.equal(replay.current.snapshot.state.roleId,role);
  assert(replay.transcript().every(e=>e.stateVersion<=i),'No future transcript while seeking');
  if(role!=='observer'&&i<all.findIndex(e=>e.snapshot.state.evidence.length))assert.deepEqual(replay.current.snapshot.state.evidence,[]);
 }
 assert.equal(replay.current.snapshot.state.completed,true);assert.deepEqual(replay.current.snapshot.state.allowedActions,[]);
 replay.seek(0);assert.equal(replay.current.snapshot.state.completed,false);
 assert.equal(client.snapshot.stateVersion,version,'Replay must not rewind the live client');
 assert.deepEqual(await view(),completed,'Reading review must not mutate the completed case');
 return all;
}
try{
 const initialSnapshot=await call(path+'?requestId='+crypto.randomUUID(),undefined,owner);assert.equal(initialSnapshot.status,200);
 assert.equal(client.acceptSnapshot(JSON.stringify(initialSnapshot.data),generation),'accepted');
 assert.equal(client.snapshot.state.roleId,role);
 if(role==='observer'){
  assert.deepEqual(client.snapshot.state.allowedActions.map(a=>a.actionId),['step']);
  for(const action of ['investigate.discover','investigate.question.Witness','investigate.present.Witness','investigate.followUp.Witness','rule.heard.allow','answer.2'])await rejected(action);
  for(let stage=0;stage<5;stage++)await act('step');
  const completed=await view();assert.equal(completed.completed,true);assert.equal(completed.attempts,0);
  assert.equal(completed.investigation,undefined,'Observer has no fabricated player investigation record');
  assert.equal(completed.assessment.ranked,false);assert.equal(completed.assessment.evidence,'旁觀不評分');
  await rejected('step');await review(completed);
  console.log('PASS observer: step-only procedure, no player score, immutable review.');
  continue;
 }
 const initial=await view();assert.deepEqual(initial.evidence,[]);assert.deepEqual(initial.investigation.contradictions,[]);
 assert.equal((await call(legacy,undefined,other)).status,404);
 assert.equal((await call(path+'/actions',command('acknowledge'),{cookie:owner.cookie})).status,403);
 await rejected('investigate.discover');
 await act('acknowledge');await act('speak','本機合成測試：核對時間。');
 assert.equal((await call(path+'/actions',command('investigate.present.Witness'),owner)).status,409);
 await act('investigate.question.Witness');await act('investigate.question.Prosecutor');await act('investigate.question.Lawyer');
 await act('investigate.discover');assert.equal((await view()).evidence.length,1);
 // Cross-role privilege boundary must also be enforced by the actual endpoint.
 if(role!=='judge')await rejected('rule.heard.allow');
 else await rejected('closeEvidence');
 assert.equal((await call(path+'/actions',command('investigate.followUp.Witness'),owner)).status,409);
 await act('investigate.present.Witness');assert.equal((await view()).investigation.contradictions.length,1);
 const follow=await act('investigate.followUp.Witness');assert.match(follow.event.text,/預寫教學回應/);
 const retry=await call(path+'/actions',follow.m,owner);assert.deepEqual(retry.data,follow.event);
 const recovered=await call(path+'/requests/'+follow.m.requestId,undefined,owner);assert.deepEqual(recovered.data,follow.event);
 assert.equal(client.acceptEvent(JSON.stringify(recovered.data),generation),'duplicate');
 assert.equal((await call(path+'/requests/'+follow.m.requestId,undefined,other)).status,404);
 const stale={...command('investigate.hint'),expectedStateVersion:version-1};
 assert.equal((await call(path+'/actions',stale,owner)).status,409);assert.equal((await view()).version,version);
 const snapshot=await call(path+'?requestId='+crypto.randomUUID(),undefined,owner);assert.ok(parseSnapshot(JSON.stringify(snapshot.data)));assert.equal(snapshot.data.stateVersion,version);
 assert.equal((await view()).investigation.contradictions[0].followed,true);
 await act('investigate.hint');
 if(role==='judge')for(const r of PROCEDURAL_REQUESTS)await act('rule.'+r.id+'.'+r.correct);
 await act('closeEvidence');await act('speak','本機合成測試：矛盾不等於證明取走平板。');
 await act('answer.0');
 const unfinished=await view();assert.equal(unfinished.completed,false);assert.equal(unfinished.investigation.debrief,null);
 await act('answer.2');
 const completed=await view(),d=completed.investigation.debrief;
 assert.equal(completed.completed,true);assert.equal(d.evidenceCoverage,100);assert.equal(d.npcCoverage,100);
 assert.equal(d.contradictionsFound,1);assert.equal(d.hintsUsed,1);assert.equal(d.reasoning.length,3);
 const categories=Object.fromEntries(d.errorAnalysis.map(e=>[e.code,e]));
 assert.equal(categories.judgment_retry.status,'observed');assert.match(categories.judgment_retry.basis,/2 次/);
 assert.equal(categories.missed_evidence.status,'not_observed');assert.equal(categories.incomplete_questioning.status,'not_observed');
 assert.equal(categories.missed_contradiction.status,'not_observed');
 for(const code of ['fact_inference','procedure_error','single_statement','legal_concept'])assert.equal(categories[code].status,'not_assessed');
 for(const entry of d.errorAnalysis)assert.deepEqual(Object.keys(entry).sort(),['basis','code','label','status']);
 assert(completed.investigation.objectives.every(o=>o.done));
 assert.equal((await call(path+'/actions',command('investigate.hint'),owner)).status,409);
 const events=await review(completed);
 assert(events.some(e=>e.kind==='npc_utterance'&&e.text===follow.event.text));
 assert.equal(events.filter(e=>e.requestId===follow.m.requestId).length,1,'Receipt recovery must not duplicate event');
 assert.equal(events.filter(e=>e.kind==='ruling').length,role==='judge'?PROCEDURAL_REQUESTS.length:0);
 console.log('PASS '+role+': actual Worker investigation, authorization, client reduction, follow-up fallback, recovery, completion and read-only replay.');
}finally{
 // Only the synthetic case created above; never clear unrelated local records.
 const removed=await call(legacy+'/delete',{confirm:true},owner);assert.equal(removed.status,200);
 assert.equal((await call(legacy,undefined,owner)).status,404);
}
}
console.log('Six role paths passed. Synthetic loopback HTTP/SQLite plus production JS reducers; NOT browser, Unity, live model or participant evidence.');
