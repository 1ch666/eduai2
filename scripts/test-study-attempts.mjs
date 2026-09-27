import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {studyFixture,reserveStudyAttempt,grantedAdmission} from './helpers/study-fixture.mjs';
const b=await build({entryPoints:['src/providers/study-provider.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {studyProvider}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const id='a'.repeat(64),fp='b'.repeat(64),input={messages:[{role:'user',content:'PRIVATE QUESTION'}],output:'text',temperature:.2,maxOutputTokens:100};
test('atomic reservation survives lost reply and reconstructing the caller; namespaces and conflicts',async()=>{
 const f=studyFixture();try{
  const results=await Promise.all(Array.from({length:8},()=>Promise.resolve().then(()=>reserveStudyAttempt(f.storage,'tutor',id,fp,10))));
  assert.equal(results.filter(r=>r.code==='RESERVED').length,1);
  assert.deepEqual(reserveStudyAttempt(f.storage,'tutor',id,fp,999999999),{code:'EXISTING'});
  assert.deepEqual(reserveStudyAttempt(f.storage,'tutor',id,'c'.repeat(64),11),{code:'CONFLICT'});
  assert.deepEqual(reserveStudyAttempt(f.storage,'photo',id,fp,12),{code:'RESERVED',issuedAt:12});
  assert.equal(f.db.prepare('SELECT issued_at FROM study_ai_attempts WHERE kind=?').get('tutor').issued_at,10);
 }finally{f.db.close();}
});
test('invalid input, failed write and unknown schema do not grant or erase prior reservations',()=>{
 const f=studyFixture();try{
  for(const args of [['other',id,fp,1],['photo','bad',fp,1],['photo',id,fp,NaN],['photo',id,'x'.repeat(64),1]])
   assert.equal(reserveStudyAttempt(f.storage,...args).code,'INVALID');
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='study_ai_attempts'").get().n,0);
  f.setFail(true);assert.throws(()=>reserveStudyAttempt(f.storage,'photo',id,fp,1));
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='study_ai_attempts'").get().n,0);
  f.setFail(false);reserveStudyAttempt(f.storage,'photo',id,fp,1);
  f.db.exec('UPDATE study_ai_meta SET version=2');
  assert.throws(()=>reserveStudyAttempt(f.storage,'photo','c'.repeat(64),fp,2),/Unsupported/);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM study_ai_attempts').get().n,1);
 }finally{f.db.close();}
});
test('bounded legacy ledger never prunes old IDs to readmit them when full',()=>{
 const f=studyFixture();try{
  reserveStudyAttempt(f.storage,'photo',id,fp,1);
  const insert=f.db.prepare('INSERT INTO study_ai_attempts VALUES(?,?,?,?)');
  f.db.exec('BEGIN');for(let i=0;i<4095;i++)insert.run('tutor',i.toString(16).padStart(64,'0'),fp,1);f.db.exec('COMMIT');
  assert.equal(reserveStudyAttempt(f.storage,'photo','c'.repeat(64),fp,2).code,'CAPACITY');
  assert.equal(reserveStudyAttempt(f.storage,'photo',id,fp,8e15).code,'EXISTING');
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM study_ai_attempts').get().n,4096);
 }finally{f.db.close();}
});
test('composition persists before admission, hashes only, and binds stable owner/day/study scope',async()=>{
 const f=studyFixture(),old=globalThis.fetch;let owner,receipt,calls=0;
 const env={OLLAMA_API_KEY:'synthetic',LEARNER:{getByName(o){owner=o;return f;}},AI_ADMISSION:grantedAdmission()};
 env.AI_ADMISSION.getByName=()=>({async admit(r){receipt=r;assert.equal(f.db.prepare('SELECT count(*) AS n FROM study_ai_attempts').get().n,1);return {code:'DISABLED',start:false};}});
 globalThis.fetch=async()=>{calls++;throw Error('must not fetch');};
 try{
  const requestId=crypto.randomUUID();const p=await studyProvider(env,'photo','verified-owner',requestId,input,false);
  assert.equal(p.ok,true);assert.equal((await p.provider.generate(input,{timeoutMs:1000})).code,'ADMISSION_DENIED');
  assert.equal(owner,'verified-owner');assert.ok(!JSON.stringify(receipt).includes(owner));
  const row=f.db.prepare('SELECT * FROM study_ai_attempts').get();
  assert.ok(receipt.id.startsWith(Math.floor(row.issued_at/86400000)+':'));
  assert.ok(!JSON.stringify(row).includes('PRIVATE'));assert.ok(!JSON.stringify(row).includes(requestId));
  assert.equal((await studyProvider(env,'photo','verified-owner',requestId,input,false)).code,'AI_ATTEMPT_ALREADY_USED');
  assert.equal((await studyProvider(env,'photo','verified-owner',requestId,{...input,temperature:.3},false)).code,'AI_REQUEST_CONFLICT');
  assert.equal(calls,0);
 }finally{globalThis.fetch=old;f.db.close();}
});
test('lost reservation response fails closed; no repeat even across later calls',async()=>{
 const f=studyFixture();let admissions=0;
 const env={OLLAMA_API_KEY:'synthetic',LEARNER:{getByName:()=>({async reserveStudyAi(...args){f.reserveStudyAi(...args);throw Error('PRIVATE');}})},AI_ADMISSION:{getByName(){admissions++;throw Error('not reached');}}};
 try{
  const requestId=crypto.randomUUID();assert.equal((await studyProvider(env,'photo','owner',requestId,input)).code,'ADMISSION_UNAVAILABLE');
  env.LEARNER.getByName=()=>f;
  assert.equal((await studyProvider(env,'photo','owner',requestId,input)).code,'AI_ATTEMPT_ALREADY_USED');assert.equal(admissions,0);
 }finally{f.db.close();}
});
test('late RPC reservation grant after timeout never constructs or calls provider',async()=>{
 let release,admissions=0;
 const env={OLLAMA_API_KEY:'synthetic',LEARNER:{getByName:()=>({reserveStudyAi:()=>new Promise(r=>release=r)})},AI_ADMISSION:{getByName(){admissions++;throw Error('never');}}};
 const r=await studyProvider(env,'tutor','owner',crypto.randomUUID(),input);
 assert.equal(r.code,'ADMISSION_UNAVAILABLE');release({code:'RESERVED',issuedAt:Date.now()});
 await new Promise(r=>setImmediate(r));assert.equal(admissions,0);
});
