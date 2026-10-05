// Administrator-only job. Reads bounded PUBLIC corpus files; never deployed.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {getPlatformProxy} from 'wrangler';
import {LEGAL_EMBEDDING_MODEL,LEGAL_DIMENSIONS} from '../src/legal-embedding.ts';
if(!process.argv.includes('--confirm-free-plan'))throw Error('Confirm Workers Free and account-wide storage quota first');
const base=new URL('../outputs/legal-rag-google/',import.meta.url);
const corpus=JSON.parse(await readFile(new URL('documents.json',base),'utf8'));
if(corpus.model!==LEGAL_EMBEDDING_MODEL||corpus.dimensions!==LEGAL_DIMENSIONS||corpus.documents.length>4800||!/^law-[a-f0-9]{16}$/.test(corpus.version))throw Error('Unexpected corpus');
const vectors=[];
for(let batch=0;batch<Math.ceil(corpus.documents.length/32);batch++){
  const raw=await readFile(new URL(`vectors-${batch}.ndjson`,base),'utf8');
  if(raw.length>2097152)throw Error('Oversized batch');
  vectors.push(...raw.trim().split('\n').map(line=>JSON.parse(line)));
}
if(vectors.length!==corpus.documents.length||new Set(vectors.map(v=>v.id)).size!==vectors.length)throw Error('Wrong vector count or duplicate IDs');
for(let i=0;i<vectors.length;i++){
  const v=vectors[i],d=corpus.documents[i];
  if(v.id!==d.id||v.namespace!==corpus.version||JSON.stringify(v.metadata)!==JSON.stringify(d.metadata)||
    createHash('sha256').update(JSON.stringify(v.metadata)).digest('hex')!==v.id||
    !Array.isArray(v.values)||v.values.length!==LEGAL_DIMENSIONS||v.values.some(n=>!Number.isFinite(n)))throw Error(`Invalid vector ${i}`);
}
const platform=await getPlatformProxy({configPath:fileURLToPath(new URL('wrangler.legal-admin.jsonc',import.meta.url)),persist:false,remoteBindings:true});
try{
  const receipts=[];
  for(let start=0;start<vectors.length;start+=500){
    const receipt=await platform.env.LEGAL_INDEX.upsert(vectors.slice(start,start+500));
    receipts.push(receipt);
    console.log(`Enqueued ${Math.min(start+500,vectors.length)}/${vectors.length}; mutation ${receipt.mutationId}`);
  }
  await writeFile(new URL(`import-${Date.now()}.json`,base),JSON.stringify({version:corpus.version,count:vectors.length,receipts},null,2),{flag:'wx'});
}finally{await platform.dispose();}
