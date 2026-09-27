import assert from 'node:assert/strict';
import {localApiTarget} from './local-api-target.mjs';
const base=localApiTarget(process.argv[2]),room=crypto.randomUUID();
const identity=id=>({id,fingerprint:'synthetic',userKey:'user',sessionKey:'session'});
async function call(op,request){
 const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({room,op,request}),signal:AbortSignal.timeout(10000)});
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
