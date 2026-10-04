import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
const bundle=await build({entryPoints:['src/court-tracing.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {observeCourtAction}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const ajv=new Ajv({strict:true});
ajv.addSchema(JSON.parse(await readFile('contracts/trace-context-v1.schema.json','utf8')));
const validate=ajv.compile(JSON.parse(await readFile('contracts/court-action-trace-v1.schema.json','utf8')));
const trace=()=>({schemaVersion:1,requestId:crypto.randomUUID(),traceId:crypto.randomUUID().replaceAll('-','')});
test('synchronous court tracing preserves result identity and only emits status metadata',()=>{
 for(const api of ['legacy','versioned'])for(const status of [undefined,400,404,409,500]){
  const records=[],context=trace(),result={private:'PRIVATE',...(status?{status}:{})};let calls=0;
  assert.equal(observeCourtAction(context,api,()=>{calls++;return result;},r=>records.push(r)),result);
  assert.equal(calls,1);assert.equal(records.length,1);assert.equal(records[0].status,status??200);
  assert.equal(records[0].traceId,context.traceId);assert(validate(records[0]),JSON.stringify(validate.errors));
  assert(!JSON.stringify(records).includes('PRIVATE'));assert(!validate({...records[0],sessionId:'PRIVATE'}));
 }
});
test('operation exceptions propagate unchanged, emitter errors cannot replace success or failure',()=>{
 const records=[],secret=Error('PRIVATE');
 assert.throws(()=>observeCourtAction(trace(),'legacy',()=>{throw secret;},r=>{records.push(r);throw Error('logger');}),e=>e===secret);
 assert.equal(records[0].status,500);assert(!JSON.stringify(records).includes('PRIVATE'));
 const value={view:'PRIVATE'};assert.equal(observeCourtAction(trace(),'versioned',()=>value,()=>{throw secret;}),value);
 for(const context of [undefined,{...trace(),secret:'PRIVATE'}]){
  assert.equal(observeCourtAction(context,'legacy',()=>value,()=>assert.fail('invalid context logged')),value);
 }
});
