import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/providers/admitted.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {createAdmittedProvider}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const reducerBundle=await build({entryPoints:['src/providers/admission.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {emptyAdmission,reduceAdmission}=await import('data:text/javascript;base64,'+Buffer.from(reducerBundle.outputFiles[0].text).toString('base64'));
const scope=()=>({id:Math.floor(Date.now()/86400000)+':attempt',userKey:'user-hash',sessionKey:'session-hash'});
const input=()=>({messages:[{role:'user',content:'private question'}],maxOutputTokens:256,temperature:.2,output:'text'});
const answer={ok:true,value:{text:'answer',usage:{inputTokens:11,outputTokens:null}}};
const grant=()=>({code:'ACCEPTED',phase:'running',start:true,deadline:Date.now()+60000});
function fixture(overrides={},generate=async()=>answer){
  const calls=[];
  const port=Object.fromEntries(['admit','poll','cancel','finish'].map(method=>[method,async(...args)=>{
    calls.push([method,...structuredClone(args)]);
    return overrides[method]?overrides[method](...args):method==='admit'?grant():{code:'SETTLED',start:false};
  }]));
  let count=0;
  const provider={contractVersion:1,id:'fake',model:'test',generate:async(...args)=>{count++;return generate(...args);}};
  return {calls,port,provider,create:(s=scope())=>createAdmittedProvider(provider,port,s),count:()=>count};
}
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('new persisted grant precedes one inference; ledger receives fingerprint, not prompt',async()=>{
  const entered=gate(),release=gate();
  const f=fixture({admit:async()=>{entered.resolve();await release.promise;return grant();}});
  const pending=f.create().generate(input(),{timeoutMs:1000});
  await entered.promise;assert.equal(f.count(),0);release.resolve();
  assert.deepEqual(await pending,answer);assert.equal(f.count(),1);
  assert.deepEqual(f.calls.map(c=>c[0]),['admit','finish']);
  assert.match(f.calls[0][1].fingerprint,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(f.calls).includes('private question'),false);
  assert.equal(f.calls[1][2],'success');assert.deepEqual(f.calls[1][3],answer.value.usage);
});

test('denials and existing requests never execute, poll or cancel another owner',async()=>{
  for(const code of ['DISABLED','CIRCUIT_OPEN','QUEUE_FULL','BUDGET','CAPACITY','CONFLICT','STALE','EXISTING','NOT_FOUND']){
    const f=fixture({admit:()=>({code,phase:'queued',start:false})});
    assert.equal((await f.create().generate(input(),{timeoutMs:1000})).code,'ADMISSION_DENIED');
    assert.equal(f.count(),0);assert.equal(f.calls.length,1);
  }
});

test('lost admission response, invalid lease or exception fails closed, no inference retry',async()=>{
  for(const reply of [()=>{throw Error('private upstream');},()=>({...grant(),deadline:0}),()=>({...grant(),deadline:Date.now()+999999})]){
    const f=fixture({admit:reply});
    assert.equal((await f.create().generate(input(),{timeoutMs:1000})).code,'ADMISSION_UNAVAILABLE');
    assert.equal(f.count(),0);assert.equal(f.calls.filter(c=>c[0]==='admit').length,1);
  }
});

test('queued owner polls for its single grant and receives a smaller inference budget',async()=>{
  const f=fixture({admit:()=>({code:'QUEUED',phase:'queued',start:false}),poll:grant},async(_input,ctx)=>{
    assert.ok(ctx.timeoutMs<1000&&ctx.timeoutMs>0);return answer;
  });
  assert.deepEqual(await f.create().generate(input(),{timeoutMs:1000}),answer);
  assert.deepEqual(f.calls.map(c=>c[0]),['admit','poll','finish']);assert.equal(f.count(),1);
});

test('caller cancellation after queue reservation releases only its queue, never runs model',async()=>{
  const controller=new AbortController();
  const f=fixture({admit:()=>{queueMicrotask(()=>controller.abort());return {code:'QUEUED',phase:'queued',start:false};}});
  const result=await f.create().generate(input(),{timeoutMs:1000,signal:controller.signal});
  assert.equal(result.code,'CANCELLED');assert.equal(f.count(),0);
  // Cancellation may race receipt delivery: if ownership was never observed,
  // the coordinator expires it rather than cancelling another worker's attempt.
  assert.ok(f.calls.filter(c=>c[0]==='cancel').length<=1);
});

test('abort an in-flight provider; late success cannot settle or restart it',async()=>{
  const entered=gate(),release=gate(),controller=new AbortController();let providerSignal;
  const f=fixture({},async(_input,ctx)=>{providerSignal=ctx.signal;entered.resolve();await release.promise;return answer;});
  const pending=f.create().generate(input(),{timeoutMs:1000,signal:controller.signal});
  await entered.promise;controller.abort();assert.equal((await pending).code,'CANCELLED');
  assert.equal(providerSignal.aborted,true);assert.deepEqual(f.calls.map(c=>c[0]),['admit','cancel']);
  release.resolve();await Promise.resolve();assert.equal(f.count(),1);assert.equal(f.calls.some(c=>c[0]==='finish'),false);
});

test('unknown provider outcomes retain lease; quota and definite failures settle once',async()=>{
  for(const code of ['NETWORK','TIMEOUT','CANCELLED','QUOTA','RESPONSE_FORMAT','PROVIDER_AUTH']){
    const f=fixture({},async()=>({ok:false,code}));
    assert.equal((await f.create().generate(input(),{timeoutMs:1000})).code,code);
    const unknown=['NETWORK','TIMEOUT','CANCELLED'].includes(code);
    assert.deepEqual(f.calls.map(c=>c[0]),['admit',unknown?'cancel':'finish']);
    if(!unknown){assert.equal(f.calls[1][2],code==='QUOTA'?'quota':'failure');assert.deepEqual(f.calls[1][3],{inputTokens:null,outputTokens:null});}
  }
});

test('lost settlement retains valid answer without reinference',async()=>{
  const f=fixture({finish:()=>{throw Error('lost');}});
  assert.deepEqual(await f.create().generate(input(),{timeoutMs:1000}),answer);
  assert.equal(f.count(),1);assert.deepEqual(f.calls.map(c=>c[0]),['admit','finish']);
});

test('invalid bounds/pre-abort cost no reservation; payload and scope pinned before awaiting',async()=>{
  const f=fixture();
  assert.equal((await f.create().generate(input(),{timeoutMs:0})).code,'INVALID_INPUT');
  assert.equal((await f.create().generate(input(),{timeoutMs:1000,signal:AbortSignal.abort()})).code,'CANCELLED');
  assert.equal((await f.create({...scope(),id:'undated'}).generate(input(),{timeoutMs:1000})).code,'INVALID_INPUT');
  assert.equal(f.calls.length,0);
  const s=scope(),p=f.create(s),i=input();const pending=p.generate(i,{timeoutMs:1000});
  i.messages[0].content='changed';s.id='changed';await pending;
  const first=f.calls[0][1];await p.generate(input(),{timeoutMs:1000});
  assert.equal(first.fingerprint,f.calls[2][1].fingerprint);assert.notEqual(first.id,'changed');
  await p.generate({...input(),temperature:.9},{timeoutMs:1000});
  assert.notEqual(first.fingerprint,f.calls[4][1].fingerprint);
});

test('unresponsive admission times out without late inference',async()=>{
  const entered=gate(),release=gate();
  const f=fixture({admit:async()=>{entered.resolve();await release.promise;return grant();}});
  const pending=f.create().generate(input(),{timeoutMs:30});await entered.promise;
  assert.equal((await pending).code,'TIMEOUT');release.resolve();await Promise.resolve();
  assert.equal(f.count(),0);assert.equal(f.calls.length,1);
});

test('two wrappers sharing actual reducer state issue at most one inference; changed payload conflicts',async()=>{
  let state=emptyAdmission();const entered=gate(),release=gate();let invocations=0;
  const policy={concurrency:2,queue:8,daily:100,userDaily:20,sessionDaily:12,queueMs:5000,leaseMs:60000,
    failureThreshold:3,cooldownMs:30000,quotaCooldownMs:60000,maxRecords:2048};
  const execute=async(command)=>{
    const result=reduceAdmission(state,command,Date.now(),policy,true);state=result.state;
    return {code:result.code,phase:result.phase,start:!!result.start,
      ...(result.start?{deadline:state.records.find(r=>r.id===result.start.id).deadline}:{})};
  };
  const port={admit:request=>execute({type:'admit',request}),poll:r=>execute({type:'poll',id:r.id}),
    cancel:r=>execute({type:'cancel',id:r.id}),finish:(r,outcome,usage)=>execute({type:'finish',id:r.id,outcome,usage})};
  const base={contractVersion:1,id:'fake',model:'test',generate:async()=>{invocations++;entered.resolve();await release.promise;return answer;}};
  const first=createAdmittedProvider(base,port,scope()).generate(input(),{timeoutMs:2000});await entered.promise;
  const duplicate=await createAdmittedProvider(base,port,scope()).generate(input(),{timeoutMs:1000});
  const conflict=await createAdmittedProvider(base,port,scope()).generate({...input(),temperature:1},{timeoutMs:1000});
  assert.equal(duplicate.code,'ADMISSION_DENIED');assert.equal(conflict.code,'ADMISSION_DENIED');
  assert.equal(state.records[0].phase,'running');assert.equal(invocations,1);
  release.resolve();assert.deepEqual(await first,answer);assert.equal(state.records[0].phase,'succeeded');
  assert.equal(state.records.length,1);
});

test('lost poll grant cancels to unknown, never infers; provider that ignores abort stays bounded',async()=>{
  const f=fixture({admit:()=>({code:'QUEUED',phase:'queued',start:false}),poll:()=>{throw Error('grant reply lost');}});
  assert.equal((await f.create().generate(input(),{timeoutMs:1000})).code,'ADMISSION_UNAVAILABLE');
  assert.deepEqual(f.calls.map(c=>c[0]),['admit','poll','cancel']);assert.equal(f.count(),0);
  const release=gate();let signal;
  const stuck=fixture({},async(_input,ctx)=>{signal=ctx.signal;await release.promise;return answer;});
  assert.equal((await stuck.create().generate(input(),{timeoutMs:100})).code,'TIMEOUT');
  assert.equal(signal.aborted,true);assert.deepEqual(stuck.calls.map(c=>c[0]),['admit','cancel']);
  release.resolve();await Promise.resolve();assert.equal(stuck.count(),1);
});
