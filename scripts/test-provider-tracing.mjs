import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
import {copyTrace} from '../src/trace-context.ts';
import {observeApiRequest} from '../src/telemetry.ts';

const bundle=await build({entryPoints:['src/providers/traced.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {traceProvider}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const validate=new Ajv({strict:true}).compile(JSON.parse(await readFile(new URL('../contracts/trace-context-v1.schema.json',import.meta.url),'utf8')));
const context=()=>({schemaVersion:1,requestId:crypto.randomUUID(),traceId:crypto.randomUUID().replaceAll('-','')});
const input={messages:[{role:'user',content:'PRIVATE_QUESTION'}],temperature:.2,maxOutputTokens:20,output:'text'};
const options={timeoutMs:1000};
const success={ok:true,value:{text:'PRIVATE_ANSWER',usage:{inputTokens:10,outputTokens:3}}};
const provider=generate=>({contractVersion:1,id:'fixture',model:'fixture:1',generate});

test('trace contract copies only bounded server IDs and rejects accessors without invoking them',()=>{
  const original=context(),copy=copyTrace(original);
  assert.deepEqual(copy,original);assert.notEqual(copy,original);assert.equal(validate(copy),true);
  let getters=0;
  const accessor={...original,get traceId(){getters++;return original.traceId;}};
  for(const invalid of [null,[],{},accessor,{...original,secret:'PRIVATE'},
    {...original,requestId:'PRIVATE'},{...original,traceId:'0'.repeat(32)},{...original,schemaVersion:2}]){
    assert.equal(copyTrace(invalid),undefined);
  }
  assert.equal(getters,0);
  original.traceId='changed';assert.notEqual(copy.traceId,original.traceId);
});

test('provider tracing preserves arguments and exact result, emits no input/output/credential data',async()=>{
  const records=[],trace=context();let calls=0;
  const observed=traceProvider(provider(async(i,o)=>{calls++;assert.equal(i,input);assert.equal(o,options);return success;}),'npc','provider-call',trace,r=>records.push(r));
  assert.equal(await observed.generate(input,options),success);assert.equal(calls,1);
  const r=records[0];assert.equal(r.requestId,trace.requestId);assert.equal(r.traceId,trace.traceId);
  assert.equal(r.outcome,'success');assert.equal(r.errorCode,null);assert.equal(r.inputTokens,10);assert.equal(r.outputTokens,3);
  assert.match(r.spanId,/^[0-9a-f]{16}$/);assert.ok(r.latencyMs>=0);assert.equal(r.costEstimate,null);
  assert.equal(JSON.stringify(records).includes('PRIVATE'),false);
  assert.deepEqual(Object.keys(r).sort(),['schemaVersion','requestId','traceId','event','spanId','feature','phase','provider','model','timestamp','latencyMs','outcome','errorCode','inputTokens','outputTokens','costEstimate'].sort());
});

test('nested governance span does not double-count usage or retry on log failure',async()=>{
  const records=[],trace=context();let calls=0;
  const inner=traceProvider(provider(async()=>{calls++;return success;}),'tutor','provider-call',trace,r=>records.push(r));
  const outer=traceProvider(inner,'tutor','governed-request',trace,r=>{records.push(r);throw Error('sink failed');});
  assert.equal(await outer.generate(input,options),success);assert.equal(calls,1);assert.equal(records.length,2);
  assert.deepEqual(records.map(r=>r.inputTokens),[10,null]);assert.deepEqual(records.map(r=>r.outputTokens),[3,null]);
  assert.notEqual(records[0].spanId,records[1].spanId);
});

test('unknown failures and invalid usage are not logged as private text or invented usage',async()=>{
  const records=[],trace=context();
  for(const value of [{ok:false,code:'PRIVATE_ERROR'}, {ok:true,value:{text:'PRIVATE',usage:{inputTokens:-1,outputTokens:Infinity}}}]){
    assert.equal(await traceProvider(provider(async()=>value),'photo','provider-call',trace,r=>records.push(r)).generate(input,options),value);
  }
  const error=Error('PRIVATE_EXCEPTION');
  await assert.rejects(traceProvider(provider(async()=>{throw error;}),'npc','provider-call',trace,r=>records.push(r)).generate(input,options),e=>e===error);
  assert.equal(records[0].errorCode,'INTERNAL_ERROR');assert.equal(records[2].outcome,'exception');
  assert.ok(records.every(r=>r.inputTokens===null&&r.outputTokens===null));assert.equal(JSON.stringify(records).includes('PRIVATE'),false);
  const raw=provider(async()=>success);assert.equal(traceProvider(raw,'npc','provider-call',undefined),raw);
});

test('interleaved HTTP operations correlate provider records to server headers, not spoofed client IDs',async()=>{
  const records=[],http=[];let release;const gate=new Promise(r=>release=r);
  const shared=provider(async i=>{if(i===input)await gate;return success;});
  const request=()=>new Request('https://test.example/api/ai/ask',{headers:{'X-Request-ID':'PRIVATE','X-Trace-ID':'PRIVATE',traceparent:'PRIVATE'}});
  const run=i=>observeApiRequest(request(),async trace=>{
    const wrapper=traceProvider(shared,'tutor','provider-call',trace,r=>records.push(r));
    await wrapper.generate(i,options);return Response.json({ok:true});
  },()=>new Response(null,{status:500}),r=>http.push(r));
  const pending=run(input),second=await run({...input});release();const first=await pending;
  assert.equal(records.length,2);assert.equal(new Set(records.map(r=>r.traceId)).size,2);
  for(const response of [first,second]){
    const r=records.find(r=>r.traceId===response.headers.get('X-Trace-ID'));
    assert.equal(r.requestId,response.headers.get('X-Request-ID'));
    assert.equal(http.find(h=>h.traceId===r.traceId).requestId,r.requestId);
  }
  assert.equal(JSON.stringify([...records,...http]).includes('PRIVATE'),false);
});
