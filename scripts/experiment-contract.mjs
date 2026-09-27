import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
const ajv=new Ajv({strict:true,allErrors:true});
const load=async name=>JSON.parse(await readFile(new URL(`../contracts/${name}.schema.json`,import.meta.url),'utf8'));
const registrySchema=ajv.compile(await load('version-registry-v1'));
const runSchema=ajv.compile(await load('experiment-run-v1'));

export function validateRegistry(value){
  if(!registrySchema(value))return {ok:false,code:'REGISTRY_SCHEMA'};
  const keys=new Set();
  for(const e of value.entries){
    const key=`${e.kind}/${e.version}`;
    if(keys.has(key))return {ok:false,code:'DUPLICATE_VERSION'};
    keys.add(key);
  }
  return {ok:true};
}

export function validateExperiment(run,registry){
  const validRegistry=validateRegistry(registry);
  if(!validRegistry.ok)return validRegistry;
  if(!runSchema(run))return {ok:false,code:'RUN_SCHEMA'};
  const date=new Date(run.timestamp);
  if(!Number.isFinite(date.getTime())||date.toISOString()!==run.timestamp)return {ok:false,code:'INVALID_TIMESTAMP'};
  // A SHA does not describe uncommitted source. Do not accept such a run as
  // attributable evidence until the exact source/config has been committed.
  if(run.worktreeDirty)return {ok:false,code:'DIRTY_SOURCE'};
  const versions=new Set(registry.entries.map(e=>`${e.kind}/${e.version}`));
  for(const [field,version] of Object.entries(run.versions)){
    if(version!==null&&!versions.has(`${field.replace(/Version$/,'')}/${version}`))return {ok:false,code:'UNKNOWN_VERSION'};
  }
  const r=run.retrievalConfig,v=run.versions;
  if(r.strategy==='disabled'){
    if(r.topK!==0||v.retrievalVersion!==null||v.embeddingVersion!==null||v.rerankerVersion!==null)return {ok:false,code:'RETRIEVAL_MISMATCH'};
  }else if(r.topK===0||v.retrievalVersion===null||(['vector','hybrid'].includes(r.strategy)&&v.embeddingVersion===null)){
    return {ok:false,code:'RETRIEVAL_MISMATCH'};
  }
  if((v.modelVersion===null)!==(v.promptVersion===null))return {ok:false,code:'MODEL_PROMPT_MISMATCH'};
  return {ok:true};
}
