// Article-level lexical retrieval over the official MOJ law snapshot. Pure and
// deterministic: no network, model or storage. Dense retrieval is evaluated
// offline (scripts/eval-legal-retrieval.mjs) and is not part of this module.

export type LegalChunk={
 chunkId:string;        // `${pcode}:${articleNo}`, stable across re-ingestion
 documentId:string;     // MOJ pcode
 lawName:string;
 article:string;        // original label, e.g. 「第 15-1 條」
 text:string;
 url:string;            // official single-article URL
 lawModifiedDate:string;// MOJ LawModifiedDate (not necessarily the effective date)
 sourceUpdateDate:string;
 checkedDate:string;    // snapshot generation time from law-data/manifest.json
 hash:string;           // SHA-256 of `${lawName}\n${article}\n${text}`
};
export type ScoredChunk={chunkId:string;score:number};

const FULL_WIDTH=/[！-～]/g;
export function normalizeQuery(text:string){
 return text.replace(FULL_WIDTH,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/\s+/g,'').toLowerCase();
}
// Chinese has no word boundaries; overlapping character bigrams are the usual
// dictionary-free BM25 unit. ASCII words/numbers stay whole.
export function tokenize(text:string):string[]{
 const out:string[]=[];
 for(const run of normalizeQuery(text).match(/[㐀-鿿]+|[a-z0-9]+(?:-[0-9]+)?/g)||[]){
  if(!/[㐀-鿿]/.test(run)){out.push(run);continue;}
  if(run.length===1)out.push(run);
  for(let i=0;i+1<run.length;i++)out.push(run.slice(i,i+2));
 }
 return out;
}
export const chunkSearchText=(c:Pick<LegalChunk,'lawName'|'article'|'text'>)=>`${c.lawName} ${c.article} ${c.text}`;

export type Bm25Index={ids:string[];lengths:Uint32Array;avgdl:number;postings:Map<string,{docs:Uint32Array;tfs:Uint16Array}>};
export function buildBm25(chunks:readonly Pick<LegalChunk,'chunkId'|'lawName'|'article'|'text'>[]):Bm25Index{
 const temp=new Map<string,number[]>(),lengths=new Uint32Array(chunks.length);
 chunks.forEach((c,doc)=>{
  const counts=new Map<string,number>(),tokens=tokenize(chunkSearchText(c));
  lengths[doc]=tokens.length;
  for(const t of tokens)counts.set(t,(counts.get(t)||0)+1);
  for(const [t,tf] of counts){let p=temp.get(t);if(!p)temp.set(t,p=[]);p.push(doc,Math.min(tf,65535));}
 });
 const postings=new Map<string,{docs:Uint32Array;tfs:Uint16Array}>();
 for(const [t,p] of temp){
  const docs=new Uint32Array(p.length/2),tfs=new Uint16Array(p.length/2);
  for(let i=0;i<docs.length;i++){docs[i]=p[2*i];tfs[i]=p[2*i+1];}
  postings.set(t,{docs,tfs});
 }
 const total=lengths.reduce((a,b)=>a+b,0);
 return {ids:chunks.map(c=>c.chunkId),lengths,avgdl:chunks.length?total/chunks.length:0,postings};
}
export function searchBm25(index:Bm25Index,query:string,k=10,{k1=1.2,b=0.75}={}):ScoredChunk[]{
 const n=index.ids.length,scores=new Map<number,number>();
 for(const t of new Set(tokenize(query))){
  const p=index.postings.get(t);if(!p)continue;
  const idf=Math.log(1+(n-p.docs.length+.5)/(p.docs.length+.5));
  for(let i=0;i<p.docs.length;i++){
   const d=p.docs[i],tf=p.tfs[i];
   scores.set(d,(scores.get(d)||0)+idf*tf*(k1+1)/(tf+k1*(1-b+b*index.lengths[d]/index.avgdl)));
  }
 }
 // Ties break on chunkId so results are reproducible across runs.
 return [...scores].map(([d,score])=>({chunkId:index.ids[d],score}))
  .sort((x,y)=>y.score-x.score||(x.chunkId<y.chunkId?-1:x.chunkId>y.chunkId?1:0)).slice(0,k);
}
/** Reciprocal Rank Fusion of ranked chunk lists (Cormack et al., k=60). */
export function reciprocalRankFusion(lists:readonly (readonly ScoredChunk[])[],k=10,c=60):ScoredChunk[]{
 const scores=new Map<string,number>();
 for(const list of lists)list.forEach((item,rank)=>scores.set(item.chunkId,(scores.get(item.chunkId)||0)+1/(c+rank+1)));
 return [...scores].map(([chunkId,score])=>({chunkId,score}))
  .sort((x,y)=>y.score-x.score||(x.chunkId<y.chunkId?-1:x.chunkId>y.chunkId?1:0)).slice(0,k);
}
