import assert from 'node:assert/strict';
import {localApiTarget} from './local-api-target.mjs';
const base=localApiTarget(process.argv[2]),room=crypto.randomUUID();
const issuedDay=Math.floor(Date.now()/86400000);
const identity=id=>({id:issuedDay+':'+id,fingerprint:'synthetic',userKey:'user',sessionKey:'session'});
async function call(op,request,targetRoom=room){
 const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({room:targetRoom,op,request}),signal:AbortSignal.timeout(10000)});
 assert.equal(r.status,200);return r.json();
}
const results=await Promise.all(Array.from({length:8},()=>call('admit',identity('one'))));
assert.deepEqual(await call('learning-expiry-drill',identity('unused'),crypto.randomUUID()),
 {accepted:'ACCEPTED',scheduled:true,rolledBack:true,expired:true,withdrawn:'WITHDRAWN',alarmCleared:true});
console.log('Local workerd learning expiry passed: SQL/alarm atomic rollback, retention and withdrawal. Timer delivery is not exercised by this explicit-clock drill.');
assert.deepEqual(await call('private-journal-drill',identity('unused'),crypto.randomUUID()),{matches:true,rolledBack:true,after:[0,0,0,0]});
console.log('Local workerd private journal passed: reconstruction, persisted delete trigger and rollback atomicity.');
const status=await call('inspect',identity('not-used'));
assert.equal(status.scope,'provider-account');assert.equal(status.providerHealth,'not-probed');
assert.equal(status.code,'READY');assert.equal('records' in status,false);
assert.equal(results.filter(r=>r.start).length,1);
assert.equal((await call('admit',identity('two'))).start,true);
assert.equal((await call('admit',identity('three'))).code,'QUEUED');
assert.deepEqual(await call('cancel',{...identity('one'),userKey:'other'}),{code:'CONFLICT',start:false});
assert.equal((await call('finish',identity('one'))).code,'SETTLED');
assert.equal((await call('poll',identity('three'))).start,true);
assert.equal((await call('poll',identity('three'))).start,false);
assert.equal((await call('admit',identity('one'))).start,false);
assert.equal((await call('cancel',identity('two'))).phase,'unknown');
for(const r of results){assert.equal('state' in r,false);assert.equal('userKey' in r,false);}
console.log('Local workerd admission RPC passed: concurrency, durable dedup, FIFO, identity fence, cancellation and receipt projection.');
const wrapperRoom=room+'-provider';
const generated=await Promise.all(Array.from({length:8},()=>call('generate',identity('wrapped'),wrapperRoom)));
assert.equal(generated.reduce((n,r)=>n+r.calls,0),1);
assert.equal(generated.filter(r=>r.result.ok).length,1);
assert.equal(generated.filter(r=>r.result.code==='ADMISSION_DENIED').length,7);
const quotaRoom=room+'-quota';
assert.equal((await call('generate-quota',identity('quota'),quotaRoom)).result.code,'QUOTA');
assert.equal((await call('inspect',identity('not-used'),quotaRoom)).code,'CIRCUIT_OPEN');
const stopped=await call('generate',identity('after-quota'),quotaRoom);
assert.equal(stopped.result.code,'ADMISSION_DENIED');assert.equal(stopped.calls,0);
console.log('Local workerd admitted provider passed: one inference across eight duplicate requests; quota opens durable circuit without new inference.');
const studyId={id:'a'.repeat(64),fingerprint:'b'.repeat(64)};
const studies=await Promise.all(Array.from({length:8},()=>call('study-reserve',studyId,room+'-study')));
assert.equal(studies.filter(r=>r.code==='RESERVED').length,1);
assert.equal(studies.filter(r=>r.code==='EXISTING').length,7);
assert.ok(Number.isSafeInteger(studies.find(r=>r.code==='RESERVED').issuedAt));
assert.deepEqual(await call('study-reserve',{...studyId,fingerprint:'c'.repeat(64)},room+'-study'),{code:'CONFLICT'});
assert.equal((await call('study-reserve',studyId,room+'-other-owner')).code,'RESERVED');
console.log('Local workerd Learner study reservation passed: additive SQLite schema, eight-way dedup, conflict and owner isolation.');
const stage=await call('stage-cycle',identity('not-used'),crypto.randomUUID());
assert.equal(stage.stateUnchanged,true);assert.equal(stage.denied.status,404);
assert.equal(stage.replies.length,8);
for(const reply of stage.replies){
 assert.deepEqual(reply,stage.replies[0]);assert.equal(reply.cached.mode,'scripted');
 assert.deepEqual(reply.cached.aiOutcome,{schemaVersion:1,scope:'response',feature:'stage-dialogue',source:'scripted',mode:'SCRIPTED_AI_FALLBACK',modelUsed:false});
}
console.log('Local workerd stage outcome passed: eight-way cached fallback, owner isolation and no authoritative state change.');
