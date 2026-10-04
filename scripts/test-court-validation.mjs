import test from 'node:test';
import assert from 'node:assert/strict';
import {COURT_VALIDATION_STAGES,validateCourtAction,newCourtAt,reduceCourt} from '../src/court-rules.ts';
const time='2026-10-04T00:00:00.000Z';
const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
const state=()=>newCourtAt('session','owner',config,time);
const action=(s,type,extra={})=>({requestId:'test',version:s.version,type,...extra});
test('ordered validation short-circuits and synchronous hooks can only veto',()=>{
 const context={sessionId:'s',caseId:'sale',role:'judge',stage:0,stateVersion:0,action:'acknowledge',evidenceId:null};
 const calls=[];
 const checks=Object.fromEntries(COURT_VALIDATION_STAGES.map(stage=>[stage,()=>calls.push(stage)]));
 validateCourtAction(checks,context,{fact:c=>{assert(Object.isFrozen(c));calls.push('fact-hook');return true;},role:()=>{calls.push('role-hook');return true;}});
 assert.deepEqual(calls,['schema','fact','fact-hook','role','role-hook','evidence','procedure','policy']);
 for(const result of [false,null,undefined,{},'true',Promise.resolve(true)]){
  calls.length=0;
  assert.throws(()=>validateCourtAction(checks,context,{fact:()=>result}),/驗證未通過：fact/);
  assert.deepEqual(calls,['schema','fact']);
 }
 assert.throws(()=>validateCourtAction(checks,context,{role:()=>{throw Error('private secret');}}),/^Error: 場次驗證未通過：role$/);
});
test('reducer rejection preserves input; hooks cannot override authoritative stage or policy',()=>{
 const s=state(),before=structuredClone(s);
 assert.throws(()=>reduceCourt(s,action(s,'acknowledge'),time,{fact:()=>false}));
 assert.deepEqual(s,before);
 assert.throws(()=>reduceCourt(s,action(s,'answer',{answer:1}),time,{fact:()=>true,role:()=>true,policy:()=>true}));
 assert.deepEqual(s,before);
 const illegal={...s,config:{...s.config,role:'respondentCounsel',respondentAid:'none'}};
 assert.throws(()=>reduceCourt(illegal,action(illegal,'acknowledge'),time,{policy:()=>true}),/法律協助/);
 const next=reduceCourt(s,action(s,'acknowledge'),time,{fact:c=>{assert(!('owner' in c));assert(!('text' in c));return true;}});
 assert.equal(next.stage,1);assert.equal(next.version,1);assert.deepEqual(s,before);
});
test('equal-length forged or duplicate evidence/ruling lists cannot close investigation',()=>{
 let s=state();s=reduceCourt(s,action(s,'acknowledge'),time);s=reduceCourt(s,action(s,'speak',{text:'確認爭點'}),time);
 for(const reviewed of [['payment','payment'],['payment','invented']]){
  const bad={...s,reviewed,rulings:['heard','shortcut']};
  assert.throws(()=>reduceCourt(bad,action(bad,'closeEvidence'),time),/每份證據/);
 }
 for(const rulings of [['heard','heard'],['heard','invented']]){
  const bad={...s,reviewed:['payment','chat'],rulings};
  assert.throws(()=>reduceCourt(bad,action(bad,'closeEvidence'),time),/准駁/);
 }
 const good={...s,reviewed:['payment','chat'],rulings:['heard','shortcut']};
 assert.equal(reduceCourt(good,action(good,'closeEvidence'),time).stage,3);
});
