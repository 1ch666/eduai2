// Offline build only: never calls AI or changes the remote index.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {LEGAL_EMBEDDING_MODEL,LEGAL_DIMENSIONS,LEGAL_EMBEDDING_VERSION} from '../src/legal-embedding.ts';
const hash=s=>createHash('sha256').update(s).digest('hex');
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('law-data/manifest.json',root),'utf8'));
const wanted=new Set(['中華民國憲法','民法','中華民國刑法','刑事訴訟法','民事訴訟法','少年事件處理法','消費者保護法','勞動基準法']);
const documents=[],found=new Set();
for(const shard of manifest.shards.filter(s=>s.source==='law')){
  const laws=JSON.parse(await readFile(new URL('law-data/'+shard.file,root),'utf8'));
  for(const law of laws){
    if(!wanted.has(law.n)||law.d)continue;
    found.add(law.n);
    for(const [article,body] of law.a){
      if(!body.trim()||body.trim()==='（刪除）')continue;
      // Never combine unrelated articles. Long articles retain article and part IDs.
      const chunks=[];let current='';
      for(const paragraph of body.split('\n')){
        if(current.length+paragraph.length+1>1800&&current){chunks.push(current);current='';}
        if(paragraph.length>1800){if(current){chunks.push(current);current='';}for(let i=0;i<paragraph.length;i+=1800)chunks.push(paragraph.slice(i,i+1800));}
        else current+=(current?'\n':'')+paragraph;
      }
      if(current)chunks.push(current);
      chunks.forEach((text,i)=>{
        const metadata={law:law.n,article,text,url:law.u,snapshot:manifest.generatedAt,amended:law.m,part:i+1};
        documents.push({id:hash(JSON.stringify(metadata)),metadata});
      });
    }
  }
}
if(found.size!==wanted.size)throw Error('Missing selected laws; do not publish incomplete manifest');
if(documents.length>4800)throw Error('Corpus exceeds reviewed migration storage budget; do not silently truncate');
const version='law-'+hash(LEGAL_EMBEDDING_VERSION+JSON.stringify(documents)).slice(0,16);
const output=new URL('outputs/legal-rag-google/',root);await mkdir(output,{recursive:true});
await writeFile(new URL('documents.json',output),JSON.stringify({version,model:LEGAL_EMBEDDING_MODEL,dimensions:LEGAL_DIMENSIONS,documents}));
await writeFile(new URL('manifest.json',output),JSON.stringify({version,embeddingVersion:LEGAL_EMBEDDING_VERSION,snapshot:manifest.generatedAt,laws:[...found],documents:documents.length,storedDimensions:documents.length*LEGAL_DIMENSIONS,source:manifest.providerUrl,effectiveDatesVerified:false},null,2)+'\n');
console.log(JSON.stringify({version,documents:documents.length,storedDimensions:documents.length*LEGAL_DIMENSIONS,output:output.pathname}));
