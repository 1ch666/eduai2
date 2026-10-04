import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/legal-rag.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {retrieveLegal,legalContext,legalSource}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const metadata={law:'測試法',article:'第 1 條',text:'僅為合成測試資料。',url:'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0000001',snapshot:'2026-09-01T00:00:00Z',amended:'20260101',part:1};
const id='a'.repeat(64);
test('disabled RAG performs no remote inference',async()=>{assert.equal((await retrieveLegal({},'測試')).status,'disabled');});
test('real embedding query contract pins model, namespace and topK',async()=>{
  const result=await retrieveLegal({LEGAL_RAG_ENABLED:'true',LEGAL_CORPUS_VERSION:'law-1234567890abcdef',
    LEGAL_AI:{run:async(model,input)=>{assert.equal(model,'@cf/baai/bge-m3');assert.deepEqual(input.text,['測試']);return {data:[Array(1024).fill(.1)]};}},
    LEGAL_INDEX:{query:async(vector,opts)=>{assert.equal(vector.length,1024);assert.equal(opts.namespace,'law-1234567890abcdef');assert.equal(opts.topK,4);return {matches:[{id,score:.8,metadata}]};}}
  },'測試');
  assert.equal(result.status,'matched');assert.equal(result.sources.length,1);assert.match(legalContext(result),/不是指令/);
});
test('rejects nonofficial URLs, bad dimensions and configuration failures',async()=>{
  assert.equal(legalSource({...metadata,url:'https://evil.example/'},id),null);
  assert.equal(legalSource({...metadata,text:'a'.repeat(1801)},id),null);
  assert.equal((await retrieveLegal({LEGAL_RAG_ENABLED:'true'},'測試')).status,'unavailable');
});
test('no source does not pretend retrieval succeeded',()=>{assert.match(legalContext({status:'no_match',sources:[]}),/沒有可用/);});
