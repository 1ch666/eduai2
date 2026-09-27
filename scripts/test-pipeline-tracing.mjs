import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
const bundle=await build({entryPoints:['src/pipeline-tracing.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {observePipelineStep}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const ajv=new Ajv({strict:true});
ajv.addSchema(JSON.parse(await readFile(new URL('../contracts/trace-context-v1.schema.json',import.meta.url),'utf8')));
const validate=ajv.compile(JSON.parse(await readFile(new URL('../contracts/pipeline-trace-v1.schema.json',import.meta.url),'utf8')));
const context=()=>({schemaVersion:1,requestId:crypto.randomUUID(),traceId:crypto.randomUUID().replaceAll('-','')});

test('all pipeline hooks preserve exact values and emit only the bounded contract',async()=>{
 for(const step of ['retrieval','reranker','validator'])for(const verdict of ['accepted','rejected']){
  const records=[],trace=context(),privateValue={text:'PRIVATE',documents:['PRIVATE'],hiddenTruth:'PRIVATE'};let calls=0;
  const result=await observePipelineStep(trace,'npc',step,()=>{calls++;return privateValue;},value=>{assert.equal(value,privateValue);return verdict;},r=>records.push(r));
  assert.equal(result,privateValue);assert.equal(calls,1);assert.equal(records.length,1);
  assert.equal(records[0].outcome,verdict);assert.equal(records[0].step,step);assert.equal(records[0].traceId,trace.traceId);
  assert.equal(validate(records[0]),true,JSON.stringify(validate.errors));assert.equal(JSON.stringify(records).includes('PRIVATE'),false);
  assert.equal(validate({...records[0],prompt:'PRIVATE'}),false);assert.equal(validate({...records[0],outcome:'PRIVATE'}),false);
 }
});

test('operation exceptions survive by identity; failing instrumentation cannot turn success into failure',async()=>{
 const trace=context(),records=[],secret=Error('PRIVATE'),value={private:'PRIVATE'};
 await assert.rejects(observePipelineStep(trace,'photo','retrieval',()=>{throw secret;},()=>{throw Error('must not classify');},r=>records.push(r)),e=>e===secret);
 assert.equal(records[0].outcome,'exception');
 for(const classifier of [()=>{throw secret;},()=> 'PRIVATE']){
  const result=await observePipelineStep(trace,'photo','validator',async()=>value,classifier,r=>{records.push(r);throw secret;});
  assert.equal(result,value);assert.equal(records.at(-1).outcome,'unclassified');
 }
 assert.equal(JSON.stringify(records).includes('PRIVATE'),false);
});

test('trace copying isolates concurrent pipelines and missing context does not invoke instrumentation',async()=>{
 const first=context(),original={...first},second=context(),records=[];let release;
 const gate=new Promise(r=>release=r);
 const pending=observePipelineStep(first,'npc','validator',async()=>{await gate;return 1;},()=> 'accepted',r=>records.push(r));
 first.traceId='PRIVATE';
 assert.equal(await observePipelineStep(second,'tutor','retrieval',()=>2,()=> 'rejected',r=>records.push(r)),2);
 release();assert.equal(await pending,1);
 assert.deepEqual(records.map(r=>r.traceId),[second.traceId,original.traceId]);assert.notEqual(records[0].spanId,records[1].spanId);
 for(const trace of [undefined,{...original,password:'PRIVATE'}])assert.equal(await observePipelineStep(trace,'npc','validator',()=>3,()=>{throw Error('must not classify');},()=>{throw Error('must not log');}),3);
});
