import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateRegistry,validateExperiment} from './experiment-contract.mjs';
const digest='a'.repeat(64);
const registry={schemaVersion:1,entries:['dataset','benchmark','model','prompt','embedding','retrieval','reranker'].map(kind=>({kind,version:'fixture-v1',contentSha256:digest}))};
const sample=()=>({schemaVersion:1,runId:crypto.randomUUID(),timestamp:'2026-09-28T00:00:00.000Z',gitCommit:'b'.repeat(40),worktreeDirty:false,seed:20260928,
  versions:{datasetVersion:'fixture-v1',benchmarkVersion:'fixture-v1',modelVersion:null,promptVersion:null,embeddingVersion:null,retrievalVersion:null,rerankerVersion:null},
  retrievalConfig:{strategy:'disabled',topK:0,configSha256:digest},resultSha256:digest});
test('repository registry is valid but does not invent completed experiments',async()=>{
  const actual=JSON.parse(await readFile(new URL('../research/version-registry.json',import.meta.url),'utf8'));
  assert.deepEqual(validateRegistry(actual),{ok:true});
  assert.deepEqual(validateExperiment(sample(),actual),{ok:false,code:'UNKNOWN_VERSION'});
});
test('offline metadata references registered versions and consistent pipeline configuration',()=>{
  assert.deepEqual(validateExperiment(sample(),registry),{ok:true});
  const run=sample();for(const key of Object.keys(run.versions))run.versions[key]='fixture-v1';
  run.retrievalConfig={strategy:'hybrid',topK:10,configSha256:digest};
  assert.deepEqual(validateExperiment(run,registry),{ok:true});
  run.versions.embeddingVersion=null;assert.equal(validateExperiment(run,registry).code,'RETRIEVAL_MISMATCH');
});
test('ambiguous registry entries, dirty source, bad dates and private extra fields fail closed',()=>{
  assert.equal(validateRegistry({...registry,entries:[...registry.entries,registry.entries[0]]}).code,'DUPLICATE_VERSION');
  for(const [patch,code] of [[{worktreeDirty:true},'DIRTY_SOURCE'],[{timestamp:'2026-02-30T00:00:00.000Z'},'INVALID_TIMESTAMP'],
    [{seed:-1},'RUN_SCHEMA'],[{gitCommit:'main'},'RUN_SCHEMA'],[{password:'private'},'RUN_SCHEMA'],[{resultSha256:'missing'},'RUN_SCHEMA']]){
    assert.equal(validateExperiment({...sample(),...patch},registry).code,code);
  }
  const run=sample();run.versions.modelVersion='fixture-v1';assert.equal(validateExperiment(run,registry).code,'MODEL_PROMPT_MISMATCH');
});
