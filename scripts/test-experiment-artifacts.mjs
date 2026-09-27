import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyExperimentArtifacts} from './verify-experiment-artifacts.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(){
 const directory=await mkdtemp(join(tmpdir(),'eduai-artifact-test-')),root=join(directory,'artifacts');
 await mkdir(root);
 const git=args=>execFileSync('git',args,{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000});
 git(['init']);git(['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','-c','commit.gpgsign=false','commit','--allow-empty','-m','synthetic source']);
 const config=JSON.stringify({strategy:'disabled',topK:0});
 for(const [path,bytes] of Object.entries({'dataset.txt':'synthetic dataset','benchmark.txt':'synthetic benchmark','result.json':'{"synthetic":true}','config.json':config}))await writeFile(join(root,path),bytes);
 const registry={schemaVersion:1,entries:['dataset','benchmark'].map(kind=>({kind,version:'synthetic-v1',contentSha256:digest(`synthetic ${kind}`)}))};
 const run={schemaVersion:1,runId:crypto.randomUUID(),timestamp:'2026-09-28T00:00:00.000Z',gitCommit:git(['rev-parse','HEAD']).trim(),worktreeDirty:false,seed:1,
  versions:{datasetVersion:'synthetic-v1',benchmarkVersion:'synthetic-v1',modelVersion:null,promptVersion:null,embeddingVersion:null,retrievalVersion:null,rerankerVersion:null},
  retrievalConfig:{strategy:'disabled',topK:0,configSha256:digest(config)},resultSha256:digest('{"synthetic":true}')};
 const manifest={schemaVersion:1,runId:run.runId,result:'result.json',retrievalConfig:'config.json',versions:registry.entries.map(e=>({kind:e.kind,version:e.version,path:e.kind+'.txt'}))};
 return {directory,root,repository:directory,git,registry,run,manifest};
}
const fail={ok:false,code:'ARTIFACT_VERIFICATION_FAILED'};
test('offline artifact verifier checks real commit and exact bytes without modifying artifacts or Git',async()=>{
 const f=await fixture();try{
  const before=f.git(['status','--porcelain']);
  assert.deepEqual(await verifyExperimentArtifacts(f),{ok:true,code:'ARTIFACTS_VERIFIED',versionArtifacts:2});
  assert.equal(f.git(['status','--porcelain']),before);
  for(const field of ['gitCommit','resultSha256']){
   const run={...f.run,[field]:'f'.repeat(field==='gitCommit'?40:64)};
   assert.deepEqual(await verifyExperimentArtifacts({...f,run}),fail);
  }
  await writeFile(join(f.root,'dataset.txt'),'modified');assert.deepEqual(await verifyExperimentArtifacts(f),fail);
 }finally{await rm(f.directory,{recursive:true,force:true});}
});
test('manifest rejects missing, duplicate, unused, cross-run and unsafe artifact references',async()=>{
 const f=await fixture();try{
  for(const change of [m=>m.versions.pop(),m=>m.versions.push(m.versions[0]),m=>m.runId=crypto.randomUUID(),m=>m.versions[0].version='other',m=>m.secret='x']){
   const manifest=structuredClone(f.manifest);change(manifest);assert.deepEqual(await verifyExperimentArtifacts({...f,manifest}),fail);
  }
  for(const path of ['../result.json','/tmp/result.json','C:/secret','https://example.invalid/data','nested/../result.json','result.json/','./result.json','NUL','a\\b','missing','dir. /x']){
   assert.deepEqual(await verifyExperimentArtifacts({...f,manifest:{...f.manifest,result:path}}),fail);
  }
  await mkdir(join(f.root,'folder'));
  assert.deepEqual(await verifyExperimentArtifacts({...f,manifest:{...f.manifest,result:'folder'}}),fail);
  // Junctions need no symlink privilege on Windows; lstat must reject links.
  await symlink(f.root,join(f.root,'linked'),process.platform==='win32'?'junction':'dir');
  assert.deepEqual(await verifyExperimentArtifacts({...f,manifest:{...f.manifest,result:'linked/result.json'}}),fail);
 }finally{await rm(f.directory,{recursive:true,force:true});}
});
test('retrieval configuration must match both digest and declared strategy/topK, with bounded JSON',async()=>{
 const f=await fixture();try{
  for(const config of ['{','null',JSON.stringify({strategy:'hybrid',topK:10}),' '.repeat(1024*1024+1)]){
   await writeFile(join(f.root,'config.json'),config);
   const run={...f.run,retrievalConfig:{...f.run.retrievalConfig,configSha256:digest(config)}};
   assert.deepEqual(await verifyExperimentArtifacts({...f,run}),fail);
  }
 }finally{await rm(f.directory,{recursive:true,force:true});}
});
