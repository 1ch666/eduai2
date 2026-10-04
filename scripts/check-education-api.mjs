// Real local workerd/RPC/SQLite check. Synthetic data, not a participant study.
import assert from 'node:assert/strict';
import {localApiTarget} from './local-api-target.mjs';
import {courtV2Response} from './court-schema-check.mjs';
import {validEducationView} from '../court/education-client.js';
const base=localApiTarget(process.argv[2]);
const fixtureAddress='2001:db8::'+crypto.randomUUID().slice(0,4);
async function call(path,method='GET',body,auth={}){
 const r=await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Origin:base,'CF-Connecting-IP':fixtureAddress,...(body?{'Content-Type':'application/json'}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();return {status:r.status,data,cookie:r.headers.getSetCookie().find(v=>v.startsWith('civic_session='))?.split(';')[0],csrf:data.csrfToken};
}
const register=()=>call('/api/auth/register','POST',{username:'edu_'+crypto.randomUUID().slice(0,8),password:crypto.randomUUID(),displayName:'合成教育接口測試'});
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
 assert.equal((await call(path,'DELETE',undefined,other)).status,404);
 const withdrawal=await call(path,'DELETE',undefined,owner);assert.equal(withdrawal.status,200);assert.equal(withdrawal.data.data.code,'WITHDRAWN');
 assert.equal((await call(path,'DELETE',undefined,owner)).status,200);
 assert.equal((await call(path,'GET',undefined,owner)).data.data.view.phase,'withdrawn');
 assert.equal((await call(path,'POST',consent,owner)).status,410);
 console.log('PASS: actual local workerd education consent/pre-test, duplicate recovery, owner/CSRF checks, false-completion rejection and withdrawal. No AI or participant data.');
}finally{
 assert.equal((await call(legacy+'/delete','POST',{confirm:true},owner)).status,200);
 assert.equal((await call(path,'GET',undefined,owner)).status,404);
}
