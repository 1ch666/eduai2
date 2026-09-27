import {open,lstat,realpath,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv';
import {validateExperiment} from './experiment-contract.mjs';

const schema=new Ajv({strict:true}).compile(JSON.parse(await readFile(new URL('../contracts/experiment-artifacts-v1.schema.json',import.meta.url),'utf8')));
const MAX_FILE=64*1024*1024,MAX_JSON=1024*1024;
const invalid=()=>new Error('ARTIFACT_VERIFICATION_FAILED');
async function boundedJson(path){
 const handle=await open(path,'r');
 try{
  const stat=await handle.stat();if(!stat.isFile()||stat.size>MAX_JSON)throw invalid();
  const bytes=Buffer.alloc(MAX_JSON+1);let used=0;
  while(used<bytes.length){const {bytesRead}=await handle.read(bytes,used,bytes.length-used,null);if(!bytesRead)break;used+=bytesRead;}
  if(used>MAX_JSON)throw invalid();
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,used)));
 }finally{await handle.close();}
}
async function artifact(root,path,collect=false){
 // Manifest paths are data, never URLs or shell arguments. Reject links and
 // traversal in EVERY component; the root is explicitly selected by operator.
 if(typeof path!=='string'||path.length>240||!/^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/.test(path))throw invalid();
 const parts=path.split('/');let target=root;
 for(const [index,part] of parts.entries()){
  if(!part||part==='.'||part==='..'||part.endsWith('.')||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))throw invalid();
  target=join(target,part);const stat=await lstat(target);if(stat.isSymbolicLink())throw invalid();
  if(index===parts.length-1?!stat.isFile():!stat.isDirectory())throw invalid();
 }
 const actual=await realpath(target),rel=relative(root,actual);
 if(!rel||rel==='..'||rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))||isAbsolute(rel))throw invalid();
 const handle=await open(actual,'r');
 try{
  const before=await handle.stat(),limit=collect?MAX_JSON:MAX_FILE;
  if(!before.isFile()||before.size>limit)throw invalid();
  const hash=createHash('sha256'),buffer=Buffer.alloc(65536),chunks=[];let bytes=0;
  while(true){const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;
   bytes+=bytesRead;if(bytes>limit)throw invalid();hash.update(buffer.subarray(0,bytesRead));
   if(collect)chunks.push(Buffer.from(buffer.subarray(0,bytesRead)));
  }
  const after=await handle.stat();
  if(bytes!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw invalid();
  return {digest:hash.digest('hex'),json:collect?JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))):null};
 }finally{await handle.close();}
}

/** Offline read-only check. Trusted operator selects root/repository; manifest
 * cannot select repository, fetch URLs, execute code or register new versions.
 * Artifact integrity and commit existence are NOT proof a run actually executed.
 */
export async function verifyExperimentArtifacts({run,registry,manifest,root,repository}){
 try{
  if(!validateExperiment(run,registry).ok||!schema(manifest)||manifest.runId!==run.runId)throw invalid();
  const needed=Object.entries(run.versions).filter(([,v])=>v!==null).map(([k,v])=>`${k.replace(/Version$/,'')}/${v}`);
  const mapped=new Map(manifest.versions.map(e=>[`${e.kind}/${e.version}`,e.path]));
  if(mapped.size!==manifest.versions.length||mapped.size!==needed.length||needed.some(k=>!mapped.has(k)))throw invalid();
  const commit=execFileSync('git',['-C',repository,'rev-parse','--verify',`${run.gitCommit}^{commit}`],
   {encoding:'utf8',timeout:10000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']}).trim();
  if(commit!==run.gitCommit)throw invalid();
  const base=await realpath(root);
  if(!(await lstat(base)).isDirectory())throw invalid();
  for(const entry of registry.entries){
   const path=mapped.get(`${entry.kind}/${entry.version}`);if(path===undefined)continue;
   if((await artifact(base,path)).digest!==entry.contentSha256)throw invalid();
  }
  if((await artifact(base,manifest.result)).digest!==run.resultSha256)throw invalid();
  const config=await artifact(base,manifest.retrievalConfig,true);
  if(config.digest!==run.retrievalConfig.configSha256||!config.json||
   config.json.strategy!==run.retrievalConfig.strategy||config.json.topK!==run.retrievalConfig.topK)throw invalid();
  return {ok:true,code:'ARTIFACTS_VERIFIED',versionArtifacts:needed.length};
 }catch{return {ok:false,code:'ARTIFACT_VERIFICATION_FAILED'};}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [runPath,registryPath,manifestPath,root,repository,...extra]=process.argv.slice(2);
  if(!repository||extra.length)throw invalid();
  const result=await verifyExperimentArtifacts({run:await boundedJson(runPath),registry:await boundedJson(registryPath),manifest:await boundedJson(manifestPath),root,repository});
  console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
 }catch{console.error('ARTIFACT_VERIFICATION_FAILED');process.exitCode=1;}
}
