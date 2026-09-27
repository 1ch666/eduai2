// Real in-memory SQLite transactions; DO lifecycle is mocked, not workerd.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
async function module(path){
 const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,
  plugins:[{name:'do',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));
   b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}'}));}}]});
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
}
const {initializeAdmissionStore,executeAdmission,ADMISSION_STORE_MAX_BYTES}=await module('src/providers/admission-store.ts');
const {AIAdmission}=await module('src/providers/admission-coordinator.ts');
const policy={concurrency:1,queue:2,daily:10,userDaily:5,sessionDaily:3,queueMs:1000,leaseMs:5000,
 failureThreshold:2,cooldownMs:1000,quotaCooldownMs:2000,maxRecords:100};
const request=id=>({id,fingerprint:'fingerprint',userKey:'user',sessionKey:'session'});
function fixture(){
 const db=new DatabaseSync(':memory:');let fail=false;
 const storage={sql:{exec(query,...args){
  if(fail&&query.startsWith('UPDATE ai_admission_state'))throw Error('injected storage failure');
  const rows=db.prepare(query).all(...args);return {toArray:()=>rows};
 }},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 initializeAdmissionStore(storage);
 const run=(identity,command,now=100,enabled=true)=>executeAdmission(storage,identity,command,now,policy,enabled);
 const admit=(id,now=100)=>run(request(id),{type:'admit',request:request(id)},now);
 return {db,storage,run,admit,setFail:value=>fail=value,raw:()=>db.prepare('SELECT body FROM ai_admission_state').get()?.body};
}
test('persistent admission commits before grant and survives recreation/lost response',()=>{
 const f=fixture();try{
  assert.equal(f.admit('one').start,true);
  assert.equal(JSON.parse(f.raw()).records[0].phase,'running');
  initializeAdmissionStore(f.storage);assert.equal(f.admit('one').start,false);
  assert.equal(f.admit('one').code,'EXISTING');
  assert.equal(f.admit('two').code,'QUEUED');
  f.run(request('one'),{type:'finish',id:'one',outcome:'success',usage:{inputTokens:null,outputTokens:1}});
  assert.equal(f.run(request('two'),{type:'poll',id:'two'}).start,true);
  assert.equal(f.run(request('two'),{type:'poll',id:'two'}).start,false);
 }finally{f.db.close();}
});
test('failed atomic write produces no grant and no partial record; retry may safely admit',()=>{
 const f=fixture();try{
  const before=f.raw();f.setFail(true);assert.throws(()=>f.admit('one'),/injected storage failure/);
  assert.equal(f.raw(),before);f.setFail(false);assert.equal(f.admit('one').start,true);
 }finally{f.db.close();}
});
test('owner/session/fingerprint mismatch cannot settle or inspect another reservation',()=>{
 const f=fixture();try{
  f.admit('one');const before=f.raw();
  for(const field of ['userKey','sessionKey','fingerprint'])for(const type of ['poll','cancel','finish']){
   const identity={...request('one'),[field]:'other'};
   const result=f.run(identity,{type,id:'one',outcome:'success',usage:{inputTokens:0,outputTokens:0}});
   assert.deepEqual(result,{code:'CONFLICT',start:false});assert.equal(f.raw(),before);
  }
  assert.throws(()=>f.run(request('one'),{type:'admit',request:request('different')}));
  assert.throws(()=>f.run(request('one'),{type:'cancel',id:'different'}));
  assert.throws(()=>f.run(request('one'),{type:'tick'}));
 }finally{f.db.close();}
});
test('corrupt, oversized, unknown-schema and missing stored state never reset budgets',()=>{
 for(const broken of ['not-json','{}',JSON.stringify({schemaVersion:2}),' '.repeat(ADMISSION_STORE_MAX_BYTES+1),null]){
  const f=fixture();try{
   f.admit('one');
   if(broken===null)f.db.exec('DELETE FROM ai_admission_state');
   else f.db.prepare('UPDATE ai_admission_state SET body=?').run(broken);
   const before=f.raw();assert.throws(()=>f.admit('two'),/Admission storage unavailable/);assert.equal(f.raw(),before);
   if(broken===null)assert.throws(()=>initializeAdmissionStore(f.storage),/Admission storage unavailable/);
  }finally{f.db.close();}
 }
});
test('unknown metadata or orphan state fail initialization without overwriting it',()=>{
 for(const orphan of [false,true]){
  const f=fixture();try{
   f.admit('one');const before=f.raw();
   f.db.exec(orphan?'DELETE FROM ai_admission_meta':'UPDATE ai_admission_meta SET version=2');
   assert.throws(()=>initializeAdmissionStore(f.storage),/Admission storage unavailable/);
   assert.equal(f.raw(),before);
  }finally{f.db.close();}
 }
});
test('expired in-flight record stays charged and never grants again after restart',()=>{
 const f=fixture();try{
  f.admit('one');initializeAdmissionStore(f.storage);
  const r=f.admit('one',5200);assert.equal(r.start,false);assert.equal(r.phase,'unknown');
  assert.equal(JSON.parse(f.raw()).records[0].usage,null);
  assert.equal(f.run(request('one'),{type:'finish',id:'one',outcome:'success',usage:{inputTokens:1,outputTokens:1}},5200).code,'STALE');
 }finally{f.db.close();}
});
test('actual coordinator class is disabled by default; concurrent calls and restart grant once',async()=>{
 const f=fixture();let ready;
 const ctx={storage:f.storage,blockConcurrencyWhile(fn){ready=fn();return ready;}};
 try{
  const disabled=new AIAdmission(ctx,{});await ready;
  assert.equal(disabled.admit(request('disabled')).code,'DISABLED');
  const active=new AIAdmission(ctx,{AI_ADMISSION_ENABLED:'true'});await ready;
  const results=await Promise.all(Array.from({length:8},()=>Promise.resolve().then(()=>active.admit(request('one')))));
  assert.equal(results.filter(r=>r.start).length,1);
  const restarted=new AIAdmission(ctx,{AI_ADMISSION_ENABLED:'true'});await ready;
  assert.equal(restarted.admit(request('one')).start,false);
  for(const result of results){assert.equal('state' in result,false);assert.equal(JSON.stringify(result).includes('fingerprint'),false);}
 }finally{f.db.close();}
});
