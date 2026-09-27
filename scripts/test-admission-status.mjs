import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
const module=async(path)=>{const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));};
const {admissionStatus}=await module('src/providers/admission-status.ts');
const {emptyAdmission,reduceAdmission}=await module('src/providers/admission.ts');
const policy={concurrency:2,queue:1,daily:20,userDaily:20,sessionDaily:20,queueMs:5000,leaseMs:10000,failureThreshold:2,cooldownMs:30000,quotaCooldownMs:60000,maxRecords:100};
const req=id=>({id,fingerprint:'PRIVATE_FP',userKey:'PRIVATE_USER',sessionKey:'PRIVATE_SESSION'});
const advance=(s,c,t=100,p=policy)=>reduceAdmission(s,c,t,p,true).state;
const add=(s,id,t=100,p=policy)=>advance(s,{type:'admit',request:req(id)},t,p);
const done=(s,id,outcome,t=101)=>advance(s,{type:'finish',id,outcome,usage:{inputTokens:1,outputTokens:2}},t);
test('status emits exact versioned public shape without granting, mutating or claiming health',()=>{
 const state=add(emptyAdmission(),'one'),before=JSON.stringify(state);
 const result=admissionStatus(state,100,policy,true);
 assert.deepEqual(result,{schemaVersion:1,scope:'provider-account',checkedAt:100,code:'READY',canAttempt:true,providerHealth:'not-probed'});
 const schema=JSON.parse(readFileSync('contracts/ai-admission-status-v1.schema.json','utf8'));
 assert.deepEqual(Object.keys(result).sort(),schema.required.sort());
 assert.equal(JSON.stringify(state),before);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 assert.equal(admissionStatus(state,100,policy,false).code,'DISABLED');
 assert.throws(()=>admissionStatus(state,99,policy,true));
});
test('full queue, unknown active lease, global budget and capacity follow actual admission gates',()=>{
 let state=emptyAdmission();state=add(state,'one');state=add(state,'two');state=add(state,'three');
 assert.equal(admissionStatus(state,101,policy,true).code,'QUEUE_FULL');
 state=advance(state,{type:'cancel',id:'one'},101);
 assert.equal(admissionStatus(state,102,policy,true).code,'QUEUE_FULL');
 const p={...policy,daily:1,userDaily:1,sessionDaily:1};
 assert.equal(admissionStatus(add(emptyAdmission(),'one',100,p),101,p,true).code,'BUDGET');
 assert.equal(admissionStatus(add(emptyAdmission(),'one'),101,{...policy,maxRecords:1},true).code,'CAPACITY');
});
test('expiry is virtual; quota opens circuit; cooldown permits only an unverified probe',()=>{
 let state=add(emptyAdmission(),'one');state=done(state,'one','quota');const before=JSON.stringify(state);
 assert.equal(admissionStatus(state,102,policy,true).code,'CIRCUIT_OPEN');
 const after=admissionStatus(state,60102,policy,true);assert.equal(after.code,'READY');assert.equal(after.providerHealth,'not-probed');
 assert.equal(JSON.stringify(state),before);
 state=add(add(emptyAdmission(),'one'),'two');
 assert.equal(admissionStatus(state,10100,policy,true).code,'CIRCUIT_OPEN');
  assert.ok(state.records.every(r=>r.phase==='running'));
  for(const now of [40100,50000,60000]){
    assert.equal(admissionStatus(state,now,policy,true).code,'READY','expired work cannot restart cooldown on every read');
    assert.equal(reduceAdmission(state,{type:'admit',request:req('recovery')},now,policy,true).code,'ACCEPTED');
  }
 state=done(add(emptyAdmission(),'old'),'old','success');
 assert.equal(admissionStatus(state,3*86400000,{...policy,maxRecords:1},true).code,'READY');
});
test('seeded command sequences agree with a fresh account-only admission decision',()=>{
 let seed=8128,state=emptyAdmission(),now=100;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<1000;i++){
  now+=random()%300;const id='request-'+i,enabled=random()%7!==0;
  const before=JSON.stringify(state),s=admissionStatus(state,now,policy,enabled);
  const actual=reduceAdmission(state,{type:'admit',request:req(id)},now,policy,enabled);
  assert.equal(s.canAttempt,['ACCEPTED','QUEUED'].includes(actual.code));
  assert.equal(s.code,s.canAttempt?'READY':actual.code);assert.equal(JSON.stringify(state),before);
  state=actual.state;
  const running=state.records.find(r=>r.phase==='running');
  if(running&&random()%2)state=done(state,running.id,random()%4?'success':'quota',now);
 }
});
