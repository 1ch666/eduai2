import test from 'node:test';
import assert from 'node:assert/strict';
import {newInvestigation,investigationDebrief} from '../src/court-investigation.ts';
const byCode=d=>Object.fromEntries(d.errorAnalysis.map(e=>[e.code,e.status]));
test('debrief distinguishes recorded omissions from unassessed reasoning and retry',()=>{
 const s=newInvestigation(),original=structuredClone(s),d=investigationDebrief(s,'已完成',{attempts:3}),codes=byCode(d);
 for(const code of ['missed_evidence','incomplete_questioning','missed_contradiction','judgment_retry'])assert.equal(codes[code],'observed');
 for(const code of ['fact_inference','procedure_error','single_statement','legal_concept'])assert.equal(codes[code],'not_assessed');
 assert.deepEqual(s,original);assert.equal(d.finalJudgment,'已完成');
});
test('full discovery is not interpreted as proof of legal or procedural competence',()=>{
 const s=newInvestigation();Object.assign(s,{viewedEvidenceIds:['camera-time'],questionedNpcIds:['Witness','Prosecutor','Lawyer'],foundContradictionIds:['departure-time']});
 const codes=byCode(investigationDebrief(s,'已完成',{attempts:1}));
 for(const code of ['missed_evidence','incomplete_questioning','missed_contradiction','judgment_retry'])assert.equal(codes[code],'not_observed');
 assert.equal(codes.procedure_error,'not_assessed');assert.equal(codes.legal_concept,'not_assessed');
});
test('missing/invalid attempt counts and observers never produce fabricated assessments',()=>{
 for(const attempts of [undefined,0,-1,NaN,Infinity,1.5])assert.equal(byCode(investigationDebrief(newInvestigation(),'未知',{attempts})).judgment_retry,'not_assessed');
 const d=investigationDebrief(newInvestigation(),'旁觀',{attempts:0,observer:true});
 assert(d.errorAnalysis.every(e=>e.status==='not_assessed'));assert(d.errorAnalysis.every(e=>e.basis.includes('旁觀')));
});
