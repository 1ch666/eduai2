import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/court-private-state.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {parsePrivateCourtState:parse}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
import {CASES,rolesFor,PROCEDURAL_REQUESTS,newCourtAt,reduceCourt} from '../src/court-rules.ts';
const ajv=new Ajv({strict:true});ajv.addSchema(JSON.parse(await readFile('contracts/case-graph-v1.schema.json','utf8')));
const shape=ajv.compile(JSON.parse(await readFile('contracts/court-private-state-v1.schema.json','utf8')));
const time='2026-09-28T00:00:00.000Z',identity={sessionId:crypto.randomUUID(),owner:'synthetic-owner'};
function initial(t=CASES[0],role='judge'){
 const age=t.procedure==='juvenile'?15:20;
 return newCourtAt(identity.sessionId,identity.owner,{caseId:t.id,role,claimantAge:20,claimantHearingAge:20,
 respondentAge:age,respondentHearingAge:age,claimantAid:role==='claimantCounsel'?'private':'none',
 respondentAid:['respondentCounsel','assistant'].includes(role)?'private':t.mandatory?'appointed':'none'},time);
}
test('private state schema and runtime accept every legal role/template path including wrong answers',()=>{
 for(const t of CASES)for(const role of rolesFor(t.procedure)){
  let s=initial(t,role);
  const check=()=>{assert.equal(shape(s),true,JSON.stringify(shape.errors));assert.deepEqual(parse(s,identity),s);};
  const act=(type,extra={})=>{s=reduceCourt(s,{requestId:crypto.randomUUID(),version:s.version,type,...extra},time);check();};
  check();
  if(role==='observer'){for(let i=0;i<5;i++)act('step');continue;}
  act('acknowledge');act('speak',{text:'確認資料與爭點'});
  if(s.investigation)act('investigate.discover');
  else for(const e of t.evidence)act('review',{evidenceId:e.id});
  if(role==='judge')for(const r of PROCEDURAL_REQUESTS){act('rule',{rulingId:r.id,decision:r.correct==='allow'?'deny':'allow'});act('rule',{rulingId:r.id,decision:r.correct});}
  act('closeEvidence');act('speak',{text:'區分事實與推論'});
  act('answer',{answer:(t.correct+1)%t.answers.length});act('answer',{answer:t.correct});
 }
});
test('private state rejects wrong identity, unsupported rules, structural and relational corruption',()=>{
 const s=initial();assert.equal(parse(s,{...identity,owner:'other'}),null);assert.equal(parse(s,{...identity,sessionId:crypto.randomUUID()}),null);
 for(const patch of [{unknown:true},{version:-1},{version:Number.MAX_SAFE_INTEGER+1},{stage:6},{completed:true},{stage:3,version:3},
 {ruleVersion:'future'},{attempts:1},{reviewed:['missing']},{reviewed:['payment','payment']},{rulings:['fake']},
 {statements:[' ' ]},{createdAt:'2026-02-30T00:00:00.000Z'},{updatedAt:'2025-01-01T00:00:00.000Z'},
 {config:{...s.config,role:'observer',respondentAge:100}},{generationVersion:'v1'},
 {generatedCase:{...CASES[0],correct:99}},{generatedCase:{...CASES[0],mandatory:true}},{privateGraph:{}}])assert.equal(parse({...s,...patch},identity),null);
 for(const key of Object.keys(s)){const broken={...s};delete broken[key];assert.equal(parse(broken,identity),null);}
});
test('private parser never invokes getters/toJSON and returns detached data',()=>{
 const s=initial();let calls=0;
 const getter={...s};Object.defineProperty(getter,'owner',{enumerable:true,get(){calls++;throw Error('called');}});
 assert.equal(parse(getter,identity),null);assert.equal(parse({...s,toJSON(){calls++;return s;}},identity),null);assert.equal(calls,0);
 for(const value of [{...s,feedback:'\ud800'},{...s,reviewed:new Array(1)},{...s,feedback:'x'.repeat(12001)},Object.assign(Object.create({extra:true}),s)])assert.equal(parse(value,identity),null);
 const parsed=parse(s,identity);parsed.config.role='observer';assert.equal(s.config.role,'judge');
});
