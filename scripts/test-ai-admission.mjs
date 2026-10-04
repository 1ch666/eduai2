import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAdmission,reduceAdmission,pruneAdmission} from '../src/providers/admission.ts';
import {parseAdmissionState} from '../src/providers/admission-state.ts';
const policy={concurrency:2,queue:2,daily:20,userDaily:10,sessionDaily:5,queueMs:5000,leaseMs:10000,
 failureThreshold:2,cooldownMs:1000,quotaCooldownMs:2000,maxRecords:100};
const request=(id,extra={})=>({id,fingerprint:'hash_'+id,userKey:'user',sessionKey:'session',...extra});
const admit=(id,extra)=>({type:'admit',request:request(id,extra)});
const finish=(id,outcome='success')=>({type:'finish',id,outcome,usage:{inputTokens:null,outputTokens:12}});
test('production daily headroom preserves persisted usage and still enforces all three caps',()=>{
 const source=readFileSync(new URL('../src/providers/admission-coordinator.ts',import.meta.url),'utf8');
 const body=source.match(/const policy:AdmissionPolicy=\{([^}]+)\}/)[1];
 const p=Object.fromEntries([...body.matchAll(/(\w+):(\d+)/g)].map(([,k,v])=>[k,Number(v)]));
 assert.deepEqual(p,{concurrency:2,queue:8,daily:300,userDaily:60,sessionDaily:30,queueMs:5000,leaseMs:60000,failureThreshold:3,cooldownMs:30000,quotaCooldownMs:60000,maxRecords:2048});
 let state=emptyAdmission();
 for(let i=0;i<300;i++){
  const req=request('production_'+i,{userKey:'u'+Math.floor(i/60),sessionKey:'s'+Math.floor(i/30)});
  const result=reduceAdmission(state,{type:'admit',request:req},100,p,true);
  assert.equal(result.code,'ACCEPTED');
  state=reduceAdmission(result.state,finish(req.id),100,p,true).state;
  if(i===29)assert.equal(reduceAdmission(state,{type:'admit',request:request('over_session',{userKey:'u0',sessionKey:'s0'})},100,p,true).code,'BUDGET');
  if(i===59)assert.equal(reduceAdmission(state,{type:'admit',request:request('over_user',{userKey:'u0',sessionKey:'new'})},100,p,true).code,'BUDGET');
 }
 assert.equal(state.records.length,300);
 assert.equal(reduceAdmission(state,{type:'admit',request:request('over_global',{userKey:'new',sessionKey:'new'})},100,p,true).code,'BUDGET');
});
function harness(p=policy){let state=emptyAdmission();return {
 run(c,t=100,enabled=true){const result=reduceAdmission(state,c,t,p,enabled);state=result.state;return result;},
 get state(){return state;}
};}
test('admission bounded concurrency/FIFO queue, duplicate and conflict are deterministic',()=>{
 const h=harness();assert.ok(h.run(admit('a')).start);assert.ok(h.run(admit('b')).start);
 assert.equal(h.run(admit('c')).code,'QUEUED');assert.equal(h.run(admit('d')).code,'QUEUED');
 assert.equal(h.run(admit('e')).code,'QUEUE_FULL');
 assert.equal(h.run(admit('a')).start,undefined);
 assert.equal(h.run(admit('a',{fingerprint:'different'})).code,'CONFLICT');
 assert.equal(h.run(admit('a',{userKey:'other'})).code,'CONFLICT');
 h.run(finish('a'));assert.equal(h.run({type:'poll',id:'d'}).code,'QUEUED');
 assert.equal(h.run({type:'poll',id:'c'}).start.id,'c');
 assert.equal(h.run({type:'poll',id:'c'}).start,undefined);
});
test('queued cancellation refunds budget but running cancellation holds its slot and budget',()=>{
 const h=harness({...policy,concurrency:1,sessionDaily:2});h.run(admit('a'));h.run(admit('b'));
 assert.equal(h.run(admit('c')).code,'BUDGET');
 h.run({type:'cancel',id:'b'});assert.equal(h.run(admit('c')).code,'QUEUED');
 assert.equal(h.run({type:'cancel',id:'a'}).phase,'unknown');
 assert.equal(h.run({type:'poll',id:'c'}).code,'QUEUED');
 assert.equal(h.run(finish('a')).code,'STALE');
 assert.equal(h.run(admit('a')).start,undefined);assert.equal(h.run(admit('d')).code,'BUDGET');
});
test('global, user and session budgets count reserved attempts, not success only',()=>{
 for(const [p,third] of [
  [{...policy,daily:2,userDaily:2,sessionDaily:2},request('c',{userKey:'new',sessionKey:'new'})],
  [{...policy,userDaily:2,sessionDaily:2},request('c',{sessionKey:'other'})],
  [{...policy,sessionDaily:2},request('c')]]){
  const h=harness(p);h.run(admit('a'));h.run(admit('b'));h.run(finish('a','failure'));
  assert.equal(h.run({type:'admit',request:third}).code,'BUDGET');
 }
});
test('expiry never reissues an unknown call and UTC rollover never transfers queued charges',()=>{
 const h=harness({...policy,concurrency:1});h.run(admit('a'),86400000-200);h.run(admit('b'),86400000-100);
 const r=h.run({type:'tick'},86400000);
 assert.equal(r.state.records[1].phase,'cancelled');assert.equal(r.state.records[0].phase,'running');
 assert.equal(h.run(admit('c'),86400000).code,'QUEUED');
 const expired=h.run({type:'tick'},86400000+10000);
 assert.equal(expired.state.records[0].phase,'unknown');
 assert.equal(h.run(admit('a'),86400000+10000).start,undefined);
 assert.equal(h.run(finish('a'),86400000+10000).code,'STALE');
});
test('kill switch cancels queued work, never grants, and retains active attempt accounting',()=>{
 const h=harness({...policy,concurrency:1});h.run(admit('a'));h.run(admit('b'));
 assert.equal(h.run({type:'poll',id:'b'},101,false).phase,'cancelled');
 assert.equal(h.run(admit('c'),101,false).code,'DISABLED');
 assert.equal(h.state.records[0].phase,'running');
 assert.equal(h.run(admit('b'),102,true).start,undefined);
});
test('quota immediately opens circuit; one half-open probe; older success cannot close it',()=>{
 const h=harness();h.run(admit('a'));h.run(admit('old'));h.run(finish('a','quota'),101);
 assert.equal(h.run(admit('b'),102).code,'CIRCUIT_OPEN');
 assert.equal(h.run(finish('old'),2200).code,'SETTLED');
 assert.equal(h.state.failures,2,'old success must not erase circuit epoch');
 assert.ok(h.run(admit('probe'),2201).start);
 assert.equal(h.run(admit('waiting'),2201).code,'QUEUED');
 h.run(finish('probe'),2202);assert.equal(h.state.failures,0);
 assert.ok(h.run({type:'poll',id:'waiting'},2203).start);
});
test('consecutive failures and timeouts open the circuit; duplicate settlements are inert',()=>{
 const h=harness();h.run(admit('a'));h.run(admit('b'));
 h.run(finish('a','failure'));h.run(finish('b','failure'));
 assert.equal(h.run(admit('c')).code,'CIRCUIT_OPEN');
 const before=h.state.openUntil;assert.equal(h.run(finish('b','quota')).code,'STALE');assert.equal(h.state.openUntil,before);
 const timeout=harness();timeout.run(admit('a'));timeout.run(admit('b'));
 timeout.run({type:'tick'},10100);assert.equal(timeout.state.failures,2);
 const opened=timeout.state.openUntil;timeout.run({type:'tick'},10101);assert.equal(timeout.state.openUntil,opened);
});
test('immutable input, nullable token observations, restart and fail-closed record cap',()=>{
 const s=emptyAdmission(),before=structuredClone(s),c=admit('a');
 const first=reduceAdmission(s,c,100,policy,true);assert.deepEqual(s,before);
 c.request.userKey='modified';assert.equal(first.state.records[0].userKey,'user');
 const reloaded=JSON.parse(JSON.stringify(first.state));
 assert.equal(reduceAdmission(reloaded,admit('a'),100,policy,true).start,undefined);
 const settled=reduceAdmission(reloaded,finish('a'),100,policy,true);
 assert.deepEqual(settled.state.records[0].usage,{inputTokens:null,outputTokens:12});
 assert.equal(reduceAdmission(settled.state,admit('b'),100,{...policy,maxRecords:1},true).code,'CAPACITY');
});
test('invalid policy, command, time and token observations fail before changing state',()=>{
 const s=emptyAdmission(),before=structuredClone(s);
 for(const p of [{...policy,concurrency:0},{...policy,queue:-1},{...policy,sessionDaily:11},{...policy,leaseMs:60001}])
  assert.throws(()=>reduceAdmission(s,admit('a'),100,p,true));
 for(const c of [null,{},admit('bad id'),{...finish('a'),usage:{inputTokens:-1,outputTokens:0}},
  {...finish('a'),outcome:'invented'},{type:'poll',id:''}])assert.throws(()=>reduceAdmission(s,c,100,policy,true));
 for(const now of [NaN,Infinity,-1,.5])assert.throws(()=>reduceAdmission(s,admit('a'),now,policy,true));
 assert.throws(()=>reduceAdmission({...s,clock:101},admit('a'),100,policy,true));assert.deepEqual(s,before);
});
test('explicit pruning preserves active records and refuses current-day cutoffs',()=>{
 const h=harness();h.run(admit('a'),100);h.run(finish('a'),101);h.run(admit('b'),2*86400000);
 const pruned=pruneAdmission(h.state,1);assert.deepEqual(pruned.records.map(r=>r.id),['b']);
 assert.equal(h.state.records.length,2);assert.throws(()=>pruneAdmission(h.state,2));
});
test('seeded random commands preserve caps and never grant an ID twice, without timing sleeps',()=>{
 let seed=9028;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>8;};
 const h=harness({...policy,daily:100,userDaily:50,sessionDaily:20,maxRecords:1000});
 const granted=new Set();let now=0;
 for(let i=0;i<3000;i++){
  now+=next()%100;const id='r'+(next()%300),type=next()%5;
  const command=type===0?admit(id,{userKey:'u'+(next()%5),sessionKey:'s'+(next()%4)}):
   type===1?{type:'poll',id}:type===2?{type:'cancel',id}:type===3?finish(id,next()%3===0?'quota':'success'):{type:'tick'};
  const previous=structuredClone(h.state),enabled=next()%20!==0,r=h.run(command,now,enabled);
  assert.deepEqual(reduceAdmission(previous,command,now,{...policy,daily:100,userDaily:50,sessionDaily:20,maxRecords:1000},enabled),r);
  assert.deepEqual(parseAdmissionState(r.state),r.state,'every real transition must be restorable');
  if(r.start){assert.ok(!granted.has(r.start.id));granted.add(r.start.id);}
  assert.ok(h.state.records.filter(v=>v.phase==='running'||v.phase==='unknown'&&now<v.deadline).length<=policy.concurrency);
  assert.ok(h.state.records.filter(v=>v.phase==='queued').length<=policy.queue);
  assert.ok(h.state.records.length<=1000);
  const charged=h.state.records.filter(v=>v.phase!=='cancelled');
  assert.ok(charged.length<=100);
  for(const u of new Set(charged.map(v=>v.userKey))){
   const rows=charged.filter(v=>v.userKey===u);assert.ok(rows.length<=50);
   for(const s of new Set(rows.map(v=>v.sessionKey)))assert.ok(rows.filter(v=>v.sessionKey===s).length<=20);
  }
 }
});
