// Real loopback Worker -> Durable Object RPC/SQLite; synthetic accounts only.
// This is NOT a browser/Unity test or an educational participant experiment.
import assert from 'node:assert/strict';
import {localApiTarget} from './local-api-target.mjs';
import {parseEvent,parseSnapshot} from '../court/protocol.js';
import {PROCEDURAL_REQUESTS} from '../src/court-rules.ts';
const base=localApiTarget(process.argv[2]),caseId='tablet-time-discrepancy-v1';
async function call(path,body,auth={}){
 const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(20000),
  headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json();return {status:r.status,data,cookie:r.headers.getSetCookie().find(s=>s.startsWith('civic_session='))?.split(';')[0],csrf:data.csrfToken};
}
assert.equal((await call('/api/capabilities')).data.npcAi,false,'Use local Worker with NPC AI disabled');
const register=()=>call('/api/auth/register',{username:'invest_'+crypto.randomUUID().slice(0,8),password:crypto.randomUUID(),displayName:'本機調查驗證'});
const owner=await register(),other=await register();assert.equal(owner.status,201);assert.equal(other.status,201);
const created=await call('/api/court/sessions',{caseId,role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'},owner);
assert.equal(created.status,201);const id=created.data.view.id,path='/api/court/v1/sessions/'+id,legacy='/api/court/sessions/'+id;
let version=0;
const command=(actionId,text='')=>({apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,caseId,expectedStateVersion:version,actionId,targetId:'',text});
async function act(actionId,text=''){
 const m=command(actionId,text),result=await call(path+'/actions',m,owner);
 assert.equal(result.status,200,actionId);assert.ok(parseEvent(JSON.stringify(result.data)));assert.equal(result.data.snapshot.stateVersion,version+1);
 version++;return {m,event:result.data};
}
async function view(){const r=await call(legacy,undefined,owner);assert.equal(r.status,200);return r.data.view;}
try{
 const initial=await view();assert.deepEqual(initial.evidence,[]);assert.deepEqual(initial.investigation.contradictions,[]);
 assert.equal((await call(legacy,undefined,other)).status,404);
 assert.equal((await call(path+'/actions',command('acknowledge'),{cookie:owner.cookie})).status,403);
 assert.equal((await call(path+'/actions',command('investigate.discover'),owner)).status,409);
 await act('acknowledge');await act('speak','本機合成測試：核對時間。');
 assert.equal((await call(path+'/actions',command('investigate.present.Witness'),owner)).status,409);
 await act('investigate.question.Witness');await act('investigate.question.Prosecutor');await act('investigate.question.Lawyer');
 await act('investigate.discover');assert.equal((await view()).evidence.length,1);
 assert.equal((await call(path+'/actions',command('investigate.followUp.Witness'),owner)).status,409);
 await act('investigate.present.Witness');assert.equal((await view()).investigation.contradictions.length,1);
 const follow=await act('investigate.followUp.Witness');assert.match(follow.event.text,/預寫教學回應/);
 const retry=await call(path+'/actions',follow.m,owner);assert.deepEqual(retry.data,follow.event);
 const recovered=await call(path+'/requests/'+follow.m.requestId,undefined,owner);assert.deepEqual(recovered.data,follow.event);
 const snapshot=await call(path+'?requestId='+crypto.randomUUID(),undefined,owner);assert.ok(parseSnapshot(JSON.stringify(snapshot.data)));assert.equal(snapshot.data.stateVersion,version);
 assert.equal((await view()).investigation.contradictions[0].followed,true);
 await act('investigate.hint');
 for(const r of PROCEDURAL_REQUESTS)await act('rule.'+r.id+'.'+r.correct);
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
 const events=await call(legacy+'/events',undefined,owner);assert.equal(events.status,200);
 assert(events.data.events.some(e=>e.kind==='npc_utterance'&&e.text===follow.event.text));
 assert.deepEqual(await view(),completed,'Reading review must not mutate the completed case');
 console.log('PASS: local Worker investigation, owner/CSRF/stage guards, presentation, follow-up fallback, receipt recovery, completion and read-only review. No real AI/browser/participant claim.');
}finally{
 // Only the synthetic case created above; never clear unrelated local records.
 const removed=await call(legacy+'/delete',{confirm:true},owner);assert.equal(removed.status,200);
}
