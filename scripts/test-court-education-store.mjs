import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {CourtEducationStore} from '../src/court-education-store.ts';
function fixture(){
 const db=new DatabaseSync(':memory:');let fail='';
 const storage={sql:{exec(q,...args){if(fail&&q.startsWith(fail))throw Error('injected');let rows;if(q.startsWith('CREATE')){db.exec(q);rows=[];}else rows=db.prepare(q).all(...args);return {toArray:()=>rows,one(){assert.equal(rows.length,1);return rows[0];}};}},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const scope=crypto.randomUUID(),store=new CourtEducationStore(storage,scope);store.initialize();
 return {db,storage,scope,store,setFail:v=>fail=v};
}
const cmd=(action,expectedRevision=0,requestId=crypto.randomUUID())=>JSON.stringify({requestId,expectedRevision,action});
test('full persisted assessment keeps scores hidden until post-test and erases receipts atomically',async()=>{
 const f=fixture();try{
  const version=f.store.view().version;
  const actions=[{kind:'consent'},{kind:'pre',submission:{version,phase:'pre',answers:{'pre-evidence':1,'pre-time':2,'pre-procedure':0}}},{kind:'case_completed'},{kind:'post',submission:{version,phase:'post',answers:{'post-evidence':2,'post-time':0,'post-procedure':1}}},{kind:'survey',submission:{version,ratings:{clarity:4,evidence:3,followup:5,usability:4}}}];
  let preBody;
  for(let i=0;i<actions.length;i++){
   const body=cmd(actions[i],i);if(i===1)preBody=body;
   const r=await f.store.apply(body,()=>i<2?'not_started':'completed',true);assert.equal(r.code,'ACCEPTED');
   if(i<3)assert.equal(r.view.results,null);
   const restarted=new CourtEducationStore(f.storage,f.scope);restarted.initialize();assert.deepEqual(restarted.view(),r.view);
  }
  assert.equal(f.store.view().phase,'complete');assert.equal(f.store.view().results.pre.score,3);
  assert.equal((await f.store.apply(preBody,()=> 'completed',true)).code,'DUPLICATE');
  const receipts=f.db.prepare('SELECT * FROM education_receipts').all();assert.equal(receipts.length,5);
  assert(receipts.every(r=>/^[0-9a-f]{64}$/.test(r.digest)));assert(!JSON.stringify(receipts).includes('answers'));
  f.setFail('UPDATE education_meta');assert.throws(()=>f.store.withdraw(),/injected/);f.setFail('');assert.equal(f.store.view().phase,'complete');assert.equal(f.db.prepare('SELECT count(*) n FROM education_receipts').get().n,5);
  f.store.withdraw();assert.equal((await f.store.apply(preBody,()=> 'completed',true)).code,'WITHDRAWN');
  assert.equal(f.db.prepare('SELECT count(*) n FROM education_receipts').get().n,0);
 }finally{f.db.close();}
});
test('durable consent survives restart; duplicate and altered submissions cannot advance twice',async()=>{
 const f=fixture();try{
  const body=cmd({kind:'consent'});
  assert.equal((await f.store.apply(body,()=> 'not_started')).code,'DISABLED');
  const results=await Promise.all([f.store.apply(body,()=> 'not_started',true),f.store.apply(body,()=> 'not_started',true)]);
  assert.deepEqual(results.map(r=>r.code).sort(),['ACCEPTED','DUPLICATE']);
  const restart=new CourtEducationStore(f.storage,f.scope);restart.initialize();assert.equal(restart.view().phase,'pre');
  assert.equal((await restart.apply(body,()=> 'active',true)).code,'DUPLICATE');
  const changed=JSON.parse(body);changed.expectedRevision=1;
  assert.equal((await restart.apply(JSON.stringify(changed),()=> 'not_started',true)).code,'CONFLICT');
  assert.equal(f.db.prepare('SELECT count(*) n FROM education_receipts').get().n,1);
 }finally{f.db.close();}
});
test('failed receipt rolls back state; late authoritative progression rejects; withdrawal fences pending work',async()=>{
 const f=fixture();try{
  f.setFail('INSERT INTO education_receipts');await assert.rejects(f.store.apply(cmd({kind:'consent'}),()=> 'not_started',true),/injected/);f.setFail('');assert.equal(f.store.view().revision,0);
  let progress='not_started';const pending=f.store.apply(cmd({kind:'consent'}),()=>progress,true);progress='active';assert.equal((await pending).code,'CONFLICT');
  const late=f.store.apply(cmd({kind:'consent'}),()=> 'not_started',true);f.store.withdraw();assert.equal((await late).code,'WITHDRAWN');
  assert.equal(f.db.prepare('SELECT count(*) n FROM education_state').get().n,0);assert.equal(f.db.prepare('SELECT count(*) n FROM education_receipts').get().n,0);
  const restart=new CourtEducationStore(f.storage,f.scope);restart.initialize();assert.deepEqual(restart.view(),{phase:'withdrawn'});
 }finally{f.db.close();}
});
test('rejects malformed input and wrong storage scope; corrupted assessment can still be withdrawn',async()=>{
 const f=fixture();try{
  for(const body of ['{}','x',' '.repeat(4097),cmd({kind:'withdraw'}),cmd({kind:'consent',privateText:'x'}),cmd({kind:'post',submission:{}})])assert.equal((await f.store.apply(body,()=> 'not_started',true)).code,'INVALID');
  assert.throws(()=>new CourtEducationStore(f.storage,crypto.randomUUID()).initialize(),/Invalid education/);
  f.db.exec("UPDATE education_state SET body='corrupt'");assert.throws(()=>f.store.view(),/Invalid education/);f.store.withdraw();assert.deepEqual(f.store.view(),{phase:'withdrawn'});
 }finally{f.db.close();}
});
