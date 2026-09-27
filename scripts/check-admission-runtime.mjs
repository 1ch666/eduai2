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
const stopped=await call('generate',identity('after-quota'),quotaRoom);
assert.equal(stopped.result.code,'ADMISSION_DENIED');assert.equal(stopped.calls,0);
console.log('Local workerd admitted provider passed: one inference across eight duplicate requests; quota opens durable circuit without new inference.');
