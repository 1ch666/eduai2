// Explicit, bounded administrative job. No secrets in files, arguments or logs.
// Explicit ranges contain at most 16 batches of 32 PUBLIC excerpts. No retries.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
if(!args.includes('--confirm-free-plan'))throw Error('Confirm Workers Free plan and remaining Workers AI / Vectorize quota first');
const first=Number(args.find(a=>a.startsWith('--batch='))?.split('=')[1]);
const last=Number(args.find(a=>a.startsWith('--through='))?.split('=')[1]??first);
if(!Number.isSafeInteger(first)||first<0||!Number.isSafeInteger(last)||last<first||last-first>=16)throw Error('Supply --batch=N and optional --through=M (at most 16 batches)');
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const useWrangler=args.includes('--wrangler');
if(!useWrangler&&(!/^[a-f0-9]{32}$/i.test(account||'')||!token))throw Error('Use --wrangler with existing login, or set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN securely');
const base=new URL('../outputs/legal-rag/',import.meta.url);
const corpus=JSON.parse(await readFile(new URL('documents.json',base),'utf8'));
if(corpus.model!=='@cf/baai/bge-m3'||corpus.dimensions!==1024||corpus.documents.length>4800)throw Error('Unexpected corpus configuration');
if(last>=Math.ceil(corpus.documents.length/32))throw Error('Batch outside corpus');
// Preflight every output before spending any inference quota.
for(let batch=first;batch<=last;batch++){
  try{await readFile(new URL(`vectors-${batch}.ndjson`,base));throw Error(`Batch ${batch} already exists`);}catch(e){if(e.code!=='ENOENT')throw e;}
}
let platform;
try{
if(useWrangler){
  const {getPlatformProxy}=await import('wrangler');
  platform=await getPlatformProxy({configPath:fileURLToPath(new URL('wrangler.legal-admin.jsonc',import.meta.url)),persist:false,remoteBindings:true});
}
for(let batch=first;batch<=last;batch++){
const docs=corpus.documents.slice(batch*32,batch*32+32);
if(!docs.length)throw Error('Batch outside corpus');
const output=new URL(`vectors-${batch}.ndjson`,base);
try{await readFile(output);throw Error('Batch output already exists; do not repeat a paid/limited inference');}catch(e){if(e.code!=='ENOENT')throw e;}
const input={text:docs.map(({metadata:m})=>`${m.law} ${m.article}（片段 ${m.part}）\n${m.text}`)};
let vectors;
if(useWrangler){
  const result=await platform.env.LEGAL_AI.run(corpus.model,input);
  vectors=result.data;
}else{
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/baai/bge-m3`,{
  method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),
  headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify(input)
});
if(!response.ok){await response.body?.cancel();throw Error(`Embedding HTTP ${response.status}; no automatic retry`);}
const reader=response.body.getReader();const chunks=[];let size=0;
while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2097152){await reader.cancel();throw Error('Embedding response too large');}chunks.push(part.value);}
const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
if(payload.success!==true)throw Error('Embedding request failed');
vectors=payload.result?.data;
}
if(!Array.isArray(vectors)||vectors.length!==docs.length||vectors.some(v=>!Array.isArray(v)||v.length!==1024||v.some(n=>typeof n!=='number'||!Number.isFinite(n))))throw Error('Invalid embeddings; nothing written');
await writeFile(output,docs.map((d,i)=>JSON.stringify({...d,values:vectors[i],namespace:corpus.version})).join('\n')+'\n',{flag:'wx'});
console.log(`Prepared batch ${batch}: ${docs.length} vectors. Import with wrangler vectorize upsert eduai2-law-bge-m3 --file outputs/legal-rag/vectors-${batch}.ndjson`);
}
}finally{if(platform)await platform.dispose();}
