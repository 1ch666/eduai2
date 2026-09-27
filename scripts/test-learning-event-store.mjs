import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const built=await build({entryPoints:['src/learning-event-store.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {LearningEventStore}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const now=1800000000000,ttl=30*86400000;
function fixture(){
 const db=new DatabaseSync(':memory:');let fail='';
 const storage={sql:{exec(query,...args){if(fail&&query.startsWith(fail))throw Error('injected');
  let rows;if(query.startsWith('CREATE')){db.exec(query);rows=[];}else rows=db.prepare(query).all(...args);
  return {toArray:()=>rows,one(){assert.equal(rows.length,1);return rows[0];}};
 }},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const policy={anonymousId:crypto.randomUUID(),conceptIds:new Set(['evidence-types'])},store=new LearningEventStore(storage,policy);
 store.initialize(now);
 const event=()=>({schemaVersion:1,eventVersion:1,eventId:crypto.randomUUID(),anonymousId:policy.anonymousId,occurredAt:now,kind:'completion',conceptId:null,value:1,sampleSize:1});
 const snapshot=()=>JSON.stringify([db.prepare('SELECT * FROM learning_meta').all(),db.prepare('SELECT * FROM learning_state').all()]);
 return {db,storage,policy,store,event,snapshot,setFail:s=>fail=s};
}
test('durable event rows survive recreation, default off, deduplication and expiry',()=>{
 const f=fixture();try{
  const event=f.event(),before=f.snapshot();
  assert.equal(f.store.apply(event,now).code,'DISABLED');assert.equal(f.snapshot(),before);
  assert.deepEqual(f.store.apply(event,now,true),{code:'ACCEPTED',nextExpiry:now+ttl});
  const restarted=new LearningEventStore(f.storage,f.policy);restarted.initialize(now);
  assert.equal(restarted.apply(event,now,true).code,'DUPLICATE');
  assert.equal(restarted.apply({...event,value:0},now,true).code,'CONFLICT');
  assert.deepEqual(restarted.prune(now+ttl),{code:'PRUNED',nextExpiry:null});
  assert.equal(JSON.parse(f.db.prepare('SELECT body FROM learning_state').get().body).events.length,0);
  assert.equal(restarted.apply(event,now+ttl,true).code,'EXPIRED_EVENT');
 }finally{f.db.close();}
});
test('failed commit and withdrawal roll back; successful withdrawal fences restart and late events',()=>{
 const f=fixture();try{
  const e=f.event(),before=f.snapshot();f.setFail('UPDATE learning_state');
  assert.throws(()=>f.store.apply(e,now,true),/injected/);assert.equal(f.snapshot(),before);f.setFail('');
  f.store.apply(e,now,true);const saved=f.snapshot();f.setFail('UPDATE learning_meta');
  assert.throws(()=>f.store.withdraw(),/injected/);assert.equal(f.snapshot(),saved);f.setFail('');
  f.store.withdraw();const withdrawn=f.snapshot();assert.equal(f.db.prepare('SELECT count(*) AS n FROM learning_state').get().n,0);
  const restarted=new LearningEventStore(f.storage,f.policy);restarted.initialize(now+1);
  assert.equal(restarted.apply(e,now+1,true).code,'WITHDRAWN');restarted.withdraw();
  assert.equal(f.snapshot(),withdrawn);
 }finally{f.db.close();}
});
test('scope mismatch and corrupt/unknown storage never reset existing records',()=>{
 for(const corrupt of [db=>db.exec('UPDATE learning_meta SET schema_version=2'),db=>db.exec("UPDATE learning_state SET body='{}'"),db=>db.exec('DELETE FROM learning_state')]){
  const f=fixture();try{
   f.store.apply(f.event(),now,true);corrupt(f.db);const saved=f.snapshot();
   assert.throws(()=>new LearningEventStore(f.storage,f.policy).initialize(now),/Invalid learning/);assert.equal(f.snapshot(),saved);
  }finally{f.db.close();}
 }
 const f=fixture();try{
  const saved=f.snapshot();assert.throws(()=>new LearningEventStore(f.storage,{...f.policy,anonymousId:crypto.randomUUID()}).initialize(now),/Invalid learning/);
  assert.equal(f.snapshot(),saved);
  f.db.exec("UPDATE learning_state SET body='corrupt'");
  f.store.withdraw();assert.equal(f.db.prepare('SELECT count(*) AS n FROM learning_state').get().n,0);
 }finally{f.db.close();}
});
