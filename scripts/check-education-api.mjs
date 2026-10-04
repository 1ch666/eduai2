// Real local workerd/RPC/SQLite check. Synthetic data, not a participant study.
import assert from 'node:assert/strict';
import {localApiTarget} from './local-api-target.mjs';
import {courtV2Response} from './court-schema-check.mjs';
import {validEducationView} from '../court/education-client.js';
import {parseEvent} from '../court/protocol.js';
import {PROCEDURAL_REQUESTS} from '../src/court-rules.ts';
const base=localApiTarget(process.argv[2]);
const fixtureAddress='2001:db8::'+crypto.randomUUID().slice(0,4);
async function call(path,method='GET',body,auth={}){
 const r=await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Origin:base,'CF-Connecting-IP':fixtureAddress,...(body?{'Content-Type':'application/json'}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();return {status:r.status,data,cookie:r.headers.getSetCookie().find(v=>v.startsWith('civic_session='))?.split(';')[0],csrf:data.csrfToken};
}
const register=()=>call('/api/auth/register','POST',{username:'edu_'+crypto.randomUUID().slice(0,8),password:crypto.randomUUID(),displayName:'合成教育接口測試'});
assert.equal((await call('/api/capabilities')).data.npcAi,false,'Disable local NPC AI before running synthetic checks');
const owner=await register(),other=await register();assert.equal(owner.status,201);assert.equal(other.status,201);
const created=await call('/api/court/sessions','POST',{caseId:'tablet-time-discrepancy-v1',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'},owner);
assert.equal(created.status,201);const id=created.data.view.id,path=`/api/v2/court/sessions/${id}/education`,legacy=`/api/court/sessions/${id}`;
const command=(kind,expectedRevision=0,submission)=>({requestId:crypto.randomUUID(),expectedRevision,action:{kind,...(submission?{submission}:{})}});
try{
 assert.equal((await call(path)).status,401);assert.equal((await call(path,'GET',undefined,other)).status,404);
 assert.equal((await call(path,'POST',command('consent'),{cookie:owner.cookie})).status,403);
 const first=await call(path,'GET',undefined,owner);assert.equal(first.status,200);assert.equal(first.data.data.view?.phase,'off',`Local education not ready: ${first.data.data.code||Object.keys(first.data.data).join(',')}`);
 assert.equal(courtV2Response(first.data),true);assert.equal(validEducationView(first.data.data.view),true);
 const consent=command('consent');const accepted=await call(path,'POST',consent,owner);assert.equal(accepted.status,200);assert.equal(accepted.data.data.code,'ACCEPTED');
 const duplicate=await call(path,'POST',consent,owner);assert.equal(duplicate.status,200);assert.equal(duplicate.data.data.code,'DUPLICATE');
 const version=accepted.data.data.view.version;
 const pre=await call(path,'POST',command('pre',1,{version,phase:'pre',answers:{'pre-evidence':1,'pre-time':2,'pre-procedure':0}}),owner);
 assert.equal(pre.status,200);assert.equal(pre.data.data.view.phase,'playing');assert.equal(pre.data.data.view.results,null);
 assert.equal(courtV2Response(pre.data),true);assert.equal(validEducationView(pre.data.data.view),true);
 assert.equal((await call(path,'POST',command('case_completed',2),owner)).status,409,'cannot pretend unfinished court is complete');
 const court=await call(legacy,'GET',undefined,owner);assert.equal(court.data.view.version,0);assert.equal(court.data.view.completed,false);
 let courtVersion=0;
 async function act(actionId,text=''){
  const result=await call(`/api/court/v1/sessions/${id}/actions`,'POST',{apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,caseId:'tablet-time-discrepancy-v1',expectedStateVersion:courtVersion,actionId,targetId:'',text},owner);
  assert.equal(result.status,200,actionId);assert.ok(parseEvent(JSON.stringify(result.data)));assert.equal(result.data.stateVersion,++courtVersion);return result.data;
 }
 await act('acknowledge');await act('speak','合成測試：請核對證詞時間。');
 for(const npc of ['Witness','Prosecutor','Lawyer'])await act('investigate.question.'+npc);
 await act('investigate.discover');await act('investigate.present.Witness');
 const follow=await act('investigate.followUp.Witness');assert.match(follow.text,/預寫教學回應/);
 for(const r of PROCEDURAL_REQUESTS)await act(`rule.${r.id}.${r.correct}`);
 await act('closeEvidence');await act('speak','合成測試：時間矛盾不等於已證明取走物品。');await act('answer.2');
 const completed=(await call(legacy,'GET',undefined,owner)).data.view;assert.equal(completed.completed,true);assert(completed.investigation.objectives.every(o=>o.done));
 const advance=await call(path,'POST',command('case_completed',2),owner);assert.equal(advance.status,200);assert.equal(advance.data.data.view.phase,'post');assert.equal(advance.data.data.view.results,null);
 const postCommand=command('post',3,{version,phase:'post',answers:{'post-evidence':2,'post-time':0,'post-procedure':1}});
 const post=await call(path,'POST',postCommand,owner);assert.equal(post.status,200);assert.equal(post.data.data.view.phase,'survey');assert.equal(post.data.data.view.results.post.score,3);
 assert.equal(courtV2Response(post.data),true);assert.equal(validEducationView(post.data.data.view),true);
 assert.equal((await call(path,'POST',postCommand,owner)).data.data.code,'DUPLICATE');
 const survey=await call(path,'POST',command('survey',4,{version,ratings:{clarity:3,evidence:3,followup:3,usability:3}}),owner);assert.equal(survey.status,200);assert.equal(survey.data.data.view.phase,'complete');
 assert.equal(courtV2Response(survey.data),true);assert.equal(validEducationView(survey.data.data.view),true);assert(!JSON.stringify(survey.data).includes('ratings'));
 assert.deepEqual((await call(path,'GET',undefined,owner)).data.data.view,survey.data.data.view);
 assert.deepEqual((await call(legacy,'GET',undefined,owner)).data.view,completed,'education must not alter completed court');
 assert.equal((await call(path,'DELETE',undefined,other)).status,404);
 const withdrawal=await call(path,'DELETE',undefined,owner);assert.equal(withdrawal.status,200);assert.equal(withdrawal.data.data.code,'WITHDRAWN');
 assert.equal((await call(path,'DELETE',undefined,owner)).status,200);
 assert.equal((await call(path,'GET',undefined,owner)).data.data.view.phase,'withdrawn');
 assert.equal((await call(path,'POST',consent,owner)).status,410);
 assert.deepEqual((await call(legacy,'GET',undefined,owner)).data.view,completed,'withdrawal must preserve court result');
 console.log('PASS: local workerd full education/court flow, deterministic evidence/follow-up, post-test/survey, duplicate recovery, owner/CSRF, result isolation and withdrawal. Synthetic data only; not browser/Unity or participant evidence.');
}finally{
 assert.equal((await call(legacy+'/delete','POST',{confirm:true},owner)).status,200);
 assert.equal((await call(path,'GET',undefined,owner)).status,404);
}
