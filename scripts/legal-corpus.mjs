// Builds article-level LegalChunks from the committed law-data snapshot.
// Offline and repeatable: same snapshot -> same chunk IDs and hashes.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../law-data/',import.meta.url));

export function articleNo(label){
 const m=/^第\s*([0-9]+(?:-[0-9]+)?)\s*條$/.exec(label);
 return m?m[1]:null;
}
/** Current (non-abandoned) articles of the chosen sources. Throws on a duplicate
 * chunk ID or a snapshot mixing source versions rather than guessing. */
export function loadLegalChunks({sources=['law'],lawNames}={}){
 const manifest=JSON.parse(readFileSync(root+'manifest.json','utf8'));
 const updates=new Map(manifest.sources.map(s=>[s.key,s.updateDate]));
 const chunks=[],seen=new Set();
 let skipped=0;
 for(const shard of manifest.shards){
  if(!sources.includes(shard.source))continue;
  for(const law of JSON.parse(readFileSync(root+shard.file,'utf8'))){
   if(law.d||lawNames&&!lawNames.includes(law.n))continue;
   const pcode=/[?&]pcode=([A-Za-z0-9]+)/.exec(law.u)?.[1];
   if(!pcode)throw Error(`no pcode: ${law.n}`);
   for(const [article,text] of law.a){
    const no=articleNo(article);
    if(!no){skipped++;continue;}
    const chunkId=`${pcode}:${no}`;
    if(seen.has(chunkId))throw Error(`duplicate chunk ${chunkId}`);
    seen.add(chunkId);
    chunks.push({chunkId,documentId:pcode,lawName:law.n,article,text,
     url:`https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=${pcode}&flno=${no}`,
     lawModifiedDate:law.m,sourceUpdateDate:updates.get(shard.source),checkedDate:manifest.generatedAt,
     hash:createHash('sha256').update(`${law.n}\n${article}\n${text}`).digest('hex')});
   }
  }
 }
 return {chunks,skipped,manifest:{generatedAt:manifest.generatedAt,sources:manifest.sources.filter(s=>sources.includes(s.key)).map(s=>({key:s.key,updateDate:s.updateDate}))}};
}
