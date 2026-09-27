import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateRegistryTransition} from './experiment-contract.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const registryPath='research/version-registry.json';
const limit=1024*1024;
const fail=()=>new Error('REGISTRY_BASE_UNAVAILABLE');

export function checkRegistryHistory({base,fetchBase=false,git,current}){
  // Never interpolate branch names or untrusted event strings into a shell.
  if(typeof base!=='string'||!/^[0-9a-f]{40}$/.test(base)||/^0+$/.test(base))throw fail();
  if(fetchBase)git(['fetch','--no-tags','--depth=1','origin',base]);
  if(git(['rev-parse','--verify',`${base}^{commit}`]).trim()!==base)throw fail();
  const previous=JSON.parse(git(['show',`${base}:${registryPath}`]));
  return validateRegistryTransition(previous,current);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2);
    if(args.some(a=>a!=='--fetch-base')||args.length>1)throw fail();
    const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:limit,timeout:60000,stdio:['ignore','pipe','pipe']});
    const base=process.env.REGISTRY_BASE||git(['rev-parse','HEAD']).trim();
    const raw=readFileSync(new URL('../research/version-registry.json',import.meta.url));
    if(raw.length>limit)throw fail();
    const result=checkRegistryHistory({base,fetchBase:args.includes('--fetch-base'),git,current:JSON.parse(raw.toString('utf8'))});
    if(!result.ok){console.error(result.code);process.exitCode=1;}
    else console.log('Registry schema and immutable version history passed');
  }catch{
    // No Git stderr, repository credentials or registry content in CI logs.
    console.error('REGISTRY_HISTORY_CHECK_FAILED');process.exitCode=1;
  }
}
