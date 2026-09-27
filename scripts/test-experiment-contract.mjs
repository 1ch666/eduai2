import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateRegistry,validateRegistryTransition,validateExperiment} from './experiment-contract.mjs';
import {checkRegistryHistory} from './check-registry-history.mjs';
const digest='a'.repeat(64);
const registry={schemaVersion:1,entries:['dataset','benchmark','model','prompt','embedding','retrieval','reranker'].map(kind=>({kind,version:'fixture-v1',contentSha256:digest}))};
const sample=()=>({schemaVersion:1,runId:crypto.randomUUID(),timestamp:'2026-09-28T00:00:00.000Z',gitCommit:'b'.repeat(40),worktreeDirty:false,seed:20260928,
  versions:{datasetVersion:'fixture-v1',benchmarkVersion:'fixture-v1',modelVersion:null,promptVersion:null,embeddingVersion:null,retrievalVersion:null,rerankerVersion:null},
  retrievalConfig:{strategy:'disabled',topK:0,configSha256:digest},resultSha256:digest});

test('published registry identities allow additions/reordering but never deletion or replacement',()=>{
 const before=structuredClone(registry);
 assert.deepEqual(validateRegistryTransition(before,{...registry,entries:[...registry.entries].reverse()}),{ok:true});
 const added={...registry,entries:[...registry.entries,{kind:'model',version:'fixture-v2',contentSha256:'c'.repeat(64)}]};
 assert.deepEqual(validateRegistryTransition(before,added),{ok:true});
 for(let i=0;i<registry.entries.length;i++){
  const changed=structuredClone(registry);changed.entries[i].contentSha256='d'.repeat(64);
  assert.equal(validateRegistryTransition(before,changed).code,'MODIFIED_VERSION');
  const removed=structuredClone(registry);removed.entries.splice(i,1);
  assert.equal(validateRegistryTransition(before,removed).code,'REMOVED_VERSION');
 }
 assert.equal(validateRegistryTransition(registry,{...registry,entries:[...registry.entries,registry.entries[0]]}).code,'DUPLICATE_VERSION');
 assert.equal(validateRegistryTransition({},registry).code,'REGISTRY_SCHEMA');
 assert.deepEqual(before,registry);
});

test('history checker binds exact commit, fails closed on missing base and never uses a shell',()=>{
 const base='c'.repeat(40),calls=[];
 const git=args=>{calls.push(args);return args[0]==='rev-parse'?base+'\n':args[0]==='show'?JSON.stringify(registry):'';};
 assert.deepEqual(checkRegistryHistory({base,fetchBase:true,git,current:registry}),{ok:true});
 assert.deepEqual(calls,[['fetch','--no-tags','--depth=1','origin',base],['rev-parse','--verify',base+'^{commit}'],['show',base+':research/version-registry.json']]);
 for(const bad of [undefined,'main','0'.repeat(40),'--help','a;echo secret','A'.repeat(40)]){
  assert.throws(()=>checkRegistryHistory({base:bad,git:()=>{assert.fail('must not execute');},current:registry}));
 }
 assert.throws(()=>checkRegistryHistory({base,git:()=>{throw Error('missing');},current:registry}));
 assert.throws(()=>checkRegistryHistory({base,git:()=> 'd'.repeat(40),current:registry}));
 assert.equal(checkRegistryHistory({base,git,current:{schemaVersion:1,entries:[]}}).code,'REMOVED_VERSION');
});

test('real Git baseline detects replacement across multiple commits without changing history',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'eduai-registry-test-'));
 const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000});
 try{
  git(['init']);git(['config','user.name','Synthetic Test']);git(['config','user.email','synthetic@example.invalid']);
  await mkdir(join(dir,'research'));
  const path=join(dir,'research','version-registry.json');
  await writeFile(path,JSON.stringify(registry));git(['add','research/version-registry.json']);git(['-c','commit.gpgsign=false','commit','-m','synthetic baseline']);
  const base=git(['rev-parse','HEAD']).trim();
  const altered=structuredClone(registry);altered.entries[0].contentSha256='e'.repeat(64);
  await writeFile(path,JSON.stringify(altered));git(['add','research/version-registry.json']);git(['-c','commit.gpgsign=false','commit','-m','synthetic invalid change']);
  git(['-c','commit.gpgsign=false','commit','--allow-empty','-m','synthetic subsequent commit']);
  const head=git(['rev-parse','HEAD']).trim();
  assert.equal(checkRegistryHistory({base,git,current:altered}).code,'MODIFIED_VERSION');
  assert.deepEqual(checkRegistryHistory({base,git,current:registry}),{ok:true});
  assert.equal(git(['rev-parse','HEAD']).trim(),head);assert.equal(git(['status','--porcelain']),'');
 }finally{await rm(dir,{recursive:true,force:true});}
});
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
