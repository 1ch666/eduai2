import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {CASES} from '../src/court-rules.ts';
const b=await build({entryPoints:['src/court-generation.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {validateGenerated,similarCase,generateModelCase}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const draft={title:'虛構修理爭議',summary:'甲方送修的器材返還後無法啟動，雙方對保管經過有不同說法。',facts:['甲方交付器材進行檢測。','乙方表示交還時曾試機。','交還後甲方表示無法啟動，原因待查。'],evidence:[{title:'收件檢測單',text:'單上有簽收記錄，但沒有完整檢測結果。'},{title:'返還對話紀錄',text:'双方確認已交還器材，沒有提到當時是否能啟動。'}]};
test('valid model narrative keeps server procedure and reasoning assessment',()=>{
 const v=validateGenerated(draft,CASES[0]);assert.ok(v);assert.equal(v.procedure,CASES[0].procedure);assert.equal(v.answers[v.correct],'先釐清資料來源與限制，再比較雙方說法');assert.ok(v.id.startsWith('ai-'));
 for(const delta of [{correct:0},{procedure:'criminal'},{facts:[]},{summary:'依第123條判決有罪'},{title:'<script>alert(1)</script>'}])assert.equal(validateGenerated({...draft,...delta},CASES[0]),null);
});
test('dedup compares narrative, not title or random ID',()=>{
 const a=validateGenerated(draft,CASES[0]);const b={...a,id:'different',title:'完全不同標題'};assert.equal(similarCase(a,b),true);assert.equal(similarCase(a,CASES[4]),false);
});
test('calls model once, parses bounded JSON and fails closed without AI',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({message:{content:JSON.stringify(draft)}});};
  await assert.rejects(generateModelCase({},CASES[0],[]));assert.equal(calls,0);
  const env={OLLAMA_API_KEY:'mock-not-real'};assert.ok(await generateModelCase(env,CASES[0],[]));assert.equal(calls,1);
  globalThis.fetch=async()=>Response.json({message:{content:'{"correct":0}'}});await assert.rejects(generateModelCase(env,CASES[0],[]));
  globalThis.fetch=async()=>new Response('',{status:429});await assert.rejects(generateModelCase(env,CASES[0],[]),/額度/);
 }finally{globalThis.fetch=original;}
});
