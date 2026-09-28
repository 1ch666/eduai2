// Offline retrieval evaluation: BM25 vs local dense embeddings vs RRF hybrid.
// Uses only a local Ollama (http://127.0.0.1:11434); never a paid or remote API.
// Usage: node scripts/eval-legal-retrieval.mjs [--models bge-m3,qwen3-embedding:0.6b] [--no-dense]
// Every number written is measured in this run; failures are recorded, not filled in.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLegalChunks } from './legal-corpus.mjs';
import { buildBm25, searchBm25, reciprocalRankFusion, chunkSearchText } from '../src/legal-retrieval.ts';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const argv=process.argv.slice(2),arg=(name,fallback)=>{const i=argv.indexOf(name);return i<0?fallback:argv[i+1];};
const MODELS=argv.includes('--no-dense')?[]:arg('--models','bge-m3,qwen3-embedding:0.6b').split(',');
const OLLAMA='http://127.0.0.1:11434';
// Dense runs cover the six laws the teaching cases use; BM25 is also reported
// on the full current-law corpus so the subset effect is visible.
const CORE_LAWS=['中華民國憲法','民法','中華民國刑法','刑事訴訟法','民事訴訟法','少年事件處理法'];
const QUERY_PREFIX={'qwen3-embedding:0.6b':'Instruct: Given a legal question, retrieve the relevant statute article\nQuery:'};
const K=10;

const bench=JSON.parse(readFileSync('benchmark/legal-retrieval-v0.json','utf8'));
const full=loadLegalChunks(),core={...full,chunks:full.chunks.filter(c=>CORE_LAWS.includes(c.lawName))};
for(const item of bench.items)for(const g of item.gold)
 if(!core.chunks.some(c=>c.chunkId===g))throw Error(`gold ${g} missing from corpus`);

function score(ranked,gold){
 const rank=ranked.findIndex(id=>gold.includes(id));
 const found=k=>gold.filter(g=>ranked.slice(0,k).includes(g)).length/gold.length;
 const dcg=ranked.slice(0,K).reduce((s,id,i)=>s+(gold.includes(id)?1/Math.log2(i+2):0),0);
 const idcg=gold.slice(0,K).reduce((s,_,i)=>s+1/Math.log2(i+2),0);
 return {'recall@1':found(1),'recall@5':found(5),'recall@10':found(10),'mrr@10':rank>=0&&rank<K?1/(rank+1):0,'ndcg@10':dcg/idcg};
}
const mean=rows=>Object.fromEntries(Object.keys(rows[0]).map(k=>[k,+(rows.reduce((s,r)=>s+r[k],0)/rows.length).toFixed(4)]));
const pct=(xs,p)=>{const s=[...xs].sort((a,b)=>a-b);return +s[Math.min(s.length-1,Math.floor(p*s.length))].toFixed(2);};

function evaluate(name,corpusName,search){
 const perQuery=[],latency=[];
 for(const item of bench.items){
  const t=performance.now(),ranked=search(item.query);latency.push(performance.now()-t);
  perQuery.push({id:item.id,top1:ranked[0]??null,...score(ranked,item.gold)});
 }
 const metrics=mean(perQuery.map(({id,top1,...m})=>m));
 console.log(name.padEnd(34),corpusName.padEnd(5),JSON.stringify(metrics));
 return {system:name,corpus:corpusName,metrics,latencyMs:{p50:pct(latency,.5),p95:pct(latency,.95)},perQuery};
}

async function ollama(path,body){
 const r=await fetch(OLLAMA+path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined);
 if(!r.ok)throw Error(`${path} ${r.status} ${await r.text()}`);
 return r.json();
}
const normalize=v=>{const n=Math.hypot(...v)||1;return Float32Array.from(v,x=>x/n);};
async function embed(model,texts){return (await ollama('/api/embed',{model,input:texts})).embeddings.map(normalize);}

async function corpusVectors(model,chunks){
 const digest=createHash('sha256').update(model+'\n'+chunks.map(c=>c.hash).join('\n')).digest('hex').slice(0,16);
 const file=`.cache/embeddings/${model.replace(/[^a-z0-9.-]/gi,'_')}-${digest}.f32`;
 if(existsSync(file)){
  const raw=readFileSync(file),all=new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4),dim=all.length/chunks.length;
  console.log(`  cached ${file}`);
  return {dim,vectors:chunks.map((_,i)=>all.subarray(i*dim,(i+1)*dim)),seconds:null};
 }
 const vectors=[],t=performance.now();
 for(let i=0;i<chunks.length;i+=16){
  vectors.push(...await embed(model,chunks.slice(i,i+16).map(chunkSearchText)));
  if(i%800===0)console.log(`  ${model} ${i}/${chunks.length}`);
 }
 const seconds=+((performance.now()-t)/1000).toFixed(1),dim=vectors[0].length;
 mkdirSync('.cache/embeddings',{recursive:true});
 const out=new Float32Array(dim*vectors.length);vectors.forEach((v,i)=>out.set(v,i*dim));
 writeFileSync(file,Buffer.from(out.buffer));
 return {dim,vectors,seconds};
}

const git=cmd=>execSync(cmd,{encoding:'utf8'}).trim();
const run={
 runAt:new Date().toISOString(),sourceCommit:git('git rev-parse HEAD'),dirty:git('git status --porcelain')!=='',
 node:process.version,benchmark:{id:bench.id,items:bench.items.length,status:bench.status,split:bench.split},
 corpus:{snapshot:full.manifest,full:full.chunks.length,core:core.chunks.length,coreLaws:CORE_LAWS},k:K,results:[],failures:[],models:[],
};
const bmFull=buildBm25(full.chunks),bmCore=buildBm25(core.chunks);
run.results.push(evaluate('bm25','full',q=>searchBm25(bmFull,q,K).map(r=>r.chunkId)));
run.results.push(evaluate('bm25','core',q=>searchBm25(bmCore,q,K).map(r=>r.chunkId)));

if(MODELS.length){
 let tags=[];
 try{run.ollamaVersion=(await ollama('/api/version')).version;tags=(await ollama('/api/tags')).models;}
 catch(e){run.failures.push({stage:'ollama',error:String(e.message)});}
 for(const model of MODELS){
  const tag=tags.find(t=>t.name===model||t.name===model+':latest');
  if(!tag){run.failures.push({model,error:'model not installed'});continue;}
  try{
   const {dim,vectors,seconds}=await corpusVectors(model,core.chunks);
   const queryVectors=new Map(),queryLatency=[];
   for(const item of bench.items){
    const t=performance.now();queryVectors.set(item.query,(await embed(model,[(QUERY_PREFIX[model]||'')+item.query]))[0]);
    queryLatency.push(performance.now()-t);
   }
   const dense=(q,k)=>{const v=queryVectors.get(q);
    return vectors.map((d,i)=>{let s=0;for(let j=0;j<dim;j++)s+=d[j]*v[j];return {chunkId:core.chunks[i].chunkId,score:s};})
     .sort((a,b)=>b.score-a.score||(a.chunkId<b.chunkId?-1:1)).slice(0,k);};
   run.models.push({model,digest:tag.digest,dim,queryPrefix:QUERY_PREFIX[model]||null,corpusEmbedSeconds:seconds,
    storageBytesFloat32:dim*4*vectors.length,queryEmbedMs:{p50:pct(queryLatency,.5),p95:pct(queryLatency,.95)}});
   run.results.push(evaluate(`dense:${model}`,'core',q=>dense(q,K).map(r=>r.chunkId)));
   run.results.push(evaluate(`hybrid-rrf:bm25+${model}`,'core',q=>reciprocalRankFusion([searchBm25(bmCore,q,50),dense(q,50)],K).map(r=>r.chunkId)));
  }catch(e){run.failures.push({model,error:String(e.message)});}
 }
}

// Search latency above excludes query embedding time (reported per model).
const stamp=run.runAt.slice(0,10),base=`research/results/legal-retrieval-${stamp}`;
mkdirSync('research/results',{recursive:true});
writeFileSync(base+'.json',JSON.stringify(run,null,1)+'\n');
const cols=['recall@1','recall@5','recall@10','mrr@10','ndcg@10'];
writeFileSync(base+'.csv',['system,corpus,'+cols.join(',')+',search_p50_ms,search_p95_ms',
 ...run.results.map(r=>[r.system,r.corpus,...cols.map(c=>r.metrics[c]),r.latencyMs.p50,r.latencyMs.p95].join(','))].join('\n')+'\n');
writeFileSync(base+'.md',[`# Legal retrieval evaluation ${stamp}`,'',
 `Source commit \`${run.sourceCommit}\`${run.dirty?' (dirty worktree)':''}; ${bench.items.length} queries (${bench.id}); corpus full=${run.corpus.full}, core=${run.corpus.core} articles.`,
 '',`> ${bench.status}`,`> ${bench.split}`,'',
 '| system | corpus | '+cols.join(' | ')+' | search p50 ms |','|'+'---|'.repeat(cols.length+3),
 ...run.results.map(r=>`| ${r.system} | ${r.corpus} | ${cols.map(c=>r.metrics[c]).join(' | ')} | ${r.latencyMs.p50} |`),'',
 ...run.models.map(m=>`- ${m.model} (${m.digest.slice(0,12)}): dim ${m.dim}, corpus embed ${m.corpusEmbedSeconds??'cached'} s, float32 storage ${(m.storageBytesFloat32/1048576).toFixed(1)} MiB, query embed p50 ${m.queryEmbedMs.p50} ms`),
 ...run.failures.map(f=>`- FAILED ${f.model||f.stage}: ${f.error}`),''].join('\n'));
console.log('wrote',base+'.{json,csv,md}');
