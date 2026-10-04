import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {CourtEducationScheduler} from '../src/court-education-scheduler.ts';
import {EDUCATION_RETENTION_MS as ttl} from '../src/court-education-store.ts';
function fixture(){
 const db=new DatabaseSync(':memory:');let scheduled=null,fail='',queue=Promise.resolve(),now=1800000000000;
 const storage={sql:{exec(q,...args){let rows;if(q.startsWith('CREATE')){db.exec(q);rows=[];}else rows=db.prepare(q).all(...args);return {toArray:()=>rows,one(){assert.equal(rows.length,1);return rows[0];}};}},
 transaction(fn){const result=queue.then(async()=>{const old=scheduled;db.exec('BEGIN');try{const r=await fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');scheduled=old;throw e;}});queue=result.catch(()=>{});return result;},
 async setAlarm(n){if(fail==='set')throw Error('alarm failure');scheduled=n;},async deleteAlarm(){if(fail==='delete')throw Error('alarm failure');scheduled=null;}};
 const scope=crypto.randomUUID(),host=(authorize)=>new CourtEducationScheduler(storage,scope,()=>now,authorize);
 const body=JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:0,action:{kind:'consent'}});
 return {db,host,body,setNow:n=>now=n,setFail:v=>fail=v,alarm:()=>scheduled};
}
test('consent schedules fixed expiry; restart preserves it and alarm erases without player activity',async()=>{
 const f=fixture();try{
  const h=f.host();await h.initialize();assert.equal(f.alarm(),null);
  assert.equal((await h.apply(f.body,()=> 'not_started')).code,'DISABLED');assert.equal(f.alarm(),null);
  await h.apply(f.body,()=> 'not_started',true);assert.equal(f.alarm(),1800000000000+ttl);
  const restart=f.host();await restart.initialize();assert.equal((await restart.view()).phase,'pre');
  f.setNow(1800000000000+ttl);await restart.alarm();assert.equal(f.alarm(),null);assert.deepEqual(await restart.view(),{phase:'withdrawn'});
  await restart.alarm();assert.equal(f.alarm(),null);
 }finally{f.db.close();}
});
test('host authorization is rechecked inside queued transactions and after async work',async()=>{
 const f=fixture();try{
  let allowed=true;const h=f.host(()=>allowed);await h.initialize();
  const queued=h.apply(f.body,()=> 'not_started',true);allowed=false;
  await assert.rejects(queued,/Education session unavailable/);
  allowed=true;
  await assert.rejects(h.apply(f.body,()=>{allowed=false;return 'not_started';},true),/Education session unavailable/);
  allowed=true;assert.equal((await h.view()).phase,'off');assert.equal(f.alarm(),null);
  assert.equal(f.db.prepare('SELECT count(*) n FROM education_receipts').get().n,0);
 }finally{f.db.close();}
});
test('alarm write and cancellation failures roll back both assessment and receipt changes',async()=>{
 const f=fixture();try{
  const h=f.host();await h.initialize();f.setFail('set');await assert.rejects(h.apply(f.body,()=> 'not_started',true),/alarm failure/);
  f.setFail('');assert.equal((await h.view()).phase,'off');assert.equal(f.db.prepare('SELECT count(*) n FROM education_receipts').get().n,0);
  await h.apply(f.body,()=> 'not_started',true);f.setNow(1800000000000+ttl);f.setFail('delete');
  await assert.rejects(h.alarm(),/alarm failure/);assert.equal(f.db.prepare('SELECT count(*) n FROM education_receipts').get().n,1);assert.equal(f.alarm(),1800000000000+ttl);
  f.setFail('');await h.alarm();assert.equal(f.db.prepare('SELECT count(*) n FROM education_receipts').get().n,0);
 }finally{f.db.close();}
});
test('withdrawal and queued duplicates cannot recreate assessment data or alarms',async()=>{
 const f=fixture();try{
  const h=f.host();await h.initialize();await h.apply(f.body,()=> 'not_started',true);
  f.setFail('delete');await assert.rejects(h.withdraw(),/alarm failure/);f.setFail('');assert.equal((await h.view()).phase,'pre');
  const replies=await Promise.all([h.withdraw(),...Array.from({length:4},()=>h.apply(f.body,()=> 'not_started',true))]);
  assert(replies.every(r=>r.code==='WITHDRAWN'));assert.equal(f.alarm(),null);assert.deepEqual(await f.host().initialize(),{phase:'withdrawn'});
 }finally{f.db.close();}
});
