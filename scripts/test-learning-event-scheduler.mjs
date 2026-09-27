import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const built=await build({entryPoints:['src/learning-event-scheduler.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {LearningEventScheduler}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const now=1800000000000,ttl=30*86400000;
function fixture(){
 const db=new DatabaseSync(':memory:');let scheduled=null,fail='',queue=Promise.resolve();
 const storage={sql:{exec(query,...args){let rows;if(query.startsWith('CREATE')){db.exec(query);rows=[];}else rows=db.prepare(query).all(...args);
  return {toArray:()=>rows,one(){assert.equal(rows.length,1);return rows[0];}};
 }},transaction(fn){const result=queue.then(async()=>{
  const previous=scheduled;db.exec('BEGIN');try{const r=await fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');scheduled=previous;throw e;}
 });queue=result.catch(()=>{});return result;},
 async setAlarm(value){if(fail==='set')throw Error('synthetic alarm failure');scheduled=value;},
 async deleteAlarm(){if(fail==='delete')throw Error('synthetic alarm failure');scheduled=null;}};
 const policy={anonymousId:crypto.randomUUID(),conceptIds:new Set(['evidence-types'])};
 const host=()=>new LearningEventScheduler(storage,policy);
 const event=(offset=0)=>({schemaVersion:1,eventVersion:1,eventId:crypto.randomUUID(),anonymousId:policy.anonymousId,occurredAt:now+offset,kind:'completion',conceptId:null,value:1,sampleSize:1});
 const rows=()=>JSON.parse(db.prepare('SELECT body FROM learning_state').get().body).events;
 return {db,host,event,rows,alarm:()=>scheduled,setFail:value=>fail=value};
}
test('scheduler maintains earliest expiry, survives restart and prunes without new events',async()=>{
 const f=fixture();try{
  const h=f.host();await h.initialize(now);assert.equal(f.alarm(),null);
  const first=f.event(),second=f.event(1000);
  assert.equal((await h.apply(first,now)).code,'DISABLED');assert.equal(f.alarm(),null);
  await h.apply(first,now,true);await h.apply(second,now+1000,true);
  assert.equal(f.alarm(),now+ttl);
  const reboot=f.host();await reboot.initialize(now+2000);assert.equal(f.alarm(),now+ttl);
  await reboot.alarm(now+ttl);assert.equal(f.rows().length,1);assert.equal(f.alarm(),now+ttl+1000);
  await reboot.alarm(now+ttl+1000);assert.equal(f.rows().length,0);assert.equal(f.alarm(),null);
  await reboot.alarm(now+ttl+1000);assert.equal(f.alarm(),null);
 }finally{f.db.close();}
});
test('failed scheduling rolls back append; failed expiry cancellation rolls back prune',async()=>{
 const f=fixture();try{
  const h=f.host();await h.initialize(now);const e=f.event();f.setFail('set');
  await assert.rejects(h.apply(e,now,true),/alarm failure/);assert.equal(f.rows().length,0);assert.equal(f.alarm(),null);
  f.setFail('');await h.apply(e,now,true);f.setFail('delete');
  await assert.rejects(h.alarm(now+ttl),/alarm failure/);assert.equal(f.rows().length,1);assert.equal(f.alarm(),now+ttl);
  f.setFail('');await f.host().alarm(now+ttl);assert.equal(f.rows().length,0);assert.equal(f.alarm(),null);
 }finally{f.db.close();}
});
test('withdrawal and late duplicate requests serialize without resurrecting records or alarms',async()=>{
 const f=fixture();try{
  const h=f.host();await h.initialize(now);const e=f.event();await h.apply(e,now,true);
  f.setFail('delete');await assert.rejects(h.withdraw(),/alarm failure/);assert.equal(f.rows().length,1);assert.equal(f.alarm(),now+ttl);
  f.setFail('');const replies=await Promise.all([h.withdraw(),...Array.from({length:8},()=>h.apply(e,now,true))]);
  assert.ok(replies.every(r=>r.code==='WITHDRAWN'));assert.equal(f.alarm(),null);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM learning_state').get().n,0);
  assert.equal((await f.host().initialize(now+1)).code,'WITHDRAWN');
  assert.equal((await f.host().alarm(now+ttl)).code,'WITHDRAWN');assert.equal(f.alarm(),null);
 }finally{f.db.close();}
});
