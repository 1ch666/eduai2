// Explicit, read-only retrieval checks; three embeddings consume free quota.
import {getPlatformProxy} from 'wrangler';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {LEGAL_DIMENSIONS,legalQueryText,legalVector} from '../src/legal-embedding.ts';
if(!process.argv.includes('--confirm-free-plan'))throw Error('Confirm Workers Free first');
const corpus=JSON.parse(await readFile(new URL('../outputs/legal-rag-google/documents.json',import.meta.url),'utf8'));
const platform=await getPlatformProxy({configPath:fileURLToPath(new URL('wrangler.legal-admin.jsonc',import.meta.url)),persist:false,remoteBindings:true});
try{
  const description=await platform.env.LEGAL_INDEX.describe();
  console.log(JSON.stringify({description}));
  if(description.dimensions!==LEGAL_DIMENSIONS||description.vectorCount!==corpus.documents.length)throw Error('Index not fully processed; do not enable RAG yet');
  for(const [question,law,article] of [['民法的成年年齡是多少？','民法','第 12 條'],['勞工正常工作時間一天幾小時？','勞動基準法','第 30 條'],['竊盜罪的構成要件是什麼？','中華民國刑法','第 320 條']]){
    const result=await platform.env.LEGAL_AI.run(corpus.model,{text:[legalQueryText(question)]});
    const matches=await platform.env.LEGAL_INDEX.query(legalVector(result.data[0]),{topK:4,returnMetadata:'all',namespace:corpus.version});
    console.log(JSON.stringify({question,matches:matches.matches.map(m=>({score:m.score,law:m.metadata?.law,article:m.metadata?.article,text:m.metadata?.text}))}));
    if(!matches.matches.some(m=>m.score>=.45&&m.metadata?.law===law&&m.metadata?.article===article))throw Error('Expected source missing from retrieval');
  }
}finally{await platform.dispose();}
