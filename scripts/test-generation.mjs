import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {CASES} from '../src/court-rules.ts';
const b=await build({entryPoints:['src/court-generation.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {validateGenerated,similarCase,generateModelCase,randomLibraryCase}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const draft={title:'虛構修理爭議',summary:'甲方送修的器材返還後無法啟動，雙方對保管經過有不同說法。',facts:['甲方交付器材進行檢測。','乙方表示交還時曾試機。','交還後甲方表示無法啟動，原因待查。'],evidence:[{title:'收件檢測單',text:'單上有簽收記錄，但沒有完整檢測結果。'},{title:'返還對話紀錄',text:'双方確認已交還器材，沒有提到當時是否能啟動。'}]};
test('library cycles without repeats and preserves answer and legal config',()=>{
 for(const base of CASES){const history=[];
  for(let round=0;round<5;round++){
   const seen=new Set();for(let i=0;i<3;i++){
    const c=randomLibraryCase(base.id,history);assert.notEqual(c.id,history.at(-1)?.id);seen.add(c.id);
    assert.equal(c.procedure,base.procedure);assert.equal(c.mandatory,base.mandatory);assert.equal(c.answers[c.correct],base.answers[base.correct]);history.push(c);
   }assert.equal(seen.size,3);
  }
 }
});
test('valid model narrative keeps server procedure and reasoning assessment',()=>{
 const v=validateGenerated(draft,CASES[0]);assert.ok(v);assert.equal(v.procedure,CASES[0].procedure);assert.equal(v.answers[v.correct],'先釐清資料來源與限制，再比較雙方說法');assert.ok(v.id.startsWith('ai-'));
 for(const delta of [{correct:0},{procedure:'criminal'},{facts:[]},{summary:'依第123條判決有罪'},{title:'<script>alert(1)</script>'}])assert.equal(validateGenerated({...draft,...delta},CASES[0]),null);
 assert.equal(validateGenerated(draft,{...CASES[0],mandatory:!CASES[0].mandatory}),null);
 assert.equal(validateGenerated(draft,{...CASES[0],id:'unknown-template'}),null);
});
test('dedup compares narrative, not title or random ID',()=>{
 const a=validateGenerated(draft,CASES[0]);const b={...a,id:'different',title:'完全不同標題'};assert.equal(similarCase(a,b),true);assert.equal(similarCase(a,CASES[4]),false);
});
test('calls model once, parses bounded JSON and fails closed without AI',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(url,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.think,false);assert.equal(body.format,'json');assert.equal(body.options.num_predict,1600);assert.equal(init.redirect,'error');return Response.json({message:{content:JSON.stringify(draft)}});};
  await assert.rejects(generateModelCase({},CASES[0],[]));assert.equal(calls,0);
  const env={OLLAMA_API_KEY:'mock-not-real'};assert.ok(await generateModelCase(env,CASES[0],[]));assert.equal(calls,1);
  globalThis.fetch=async()=>Response.json({message:{content:'{"correct":0}'}});await assert.rejects(generateModelCase(env,CASES[0],[]));
  globalThis.fetch=async()=>new Response('',{status:429});await assert.rejects(generateModelCase(env,CASES[0],[]),/額度/);
 }finally{globalThis.fetch=original;}
});

test('vendor-independent case provider is bounded, untrusted, and cannot bypass kill switch',async()=>{
 let calls=0;
 const previous=CASES.map(c=>structuredClone(c));const before=structuredClone(previous);
 const provider={contractVersion:1,id:'fake',model:'offline',async generate(input,context){
  calls++;assert.deepEqual(context,{timeoutMs:20000,maxResponseBytes:18000});
  assert.equal(input.output,'json');assert.equal(input.temperature,.9);assert.equal(input.maxOutputTokens,1600);
  assert.equal(JSON.parse(input.messages[1].content).category,CASES[0].id);
  return {ok:true,value:{text:JSON.stringify(draft),usage:{inputTokens:null,outputTokens:null}}};
 }};
 assert.ok(await generateModelCase({},CASES[0],previous,provider));assert.equal(calls,1);assert.deepEqual(previous,before);
 await assert.rejects(generateModelCase({COURT_AI_ENABLED:'false'},CASES[0],[],provider),/尚未啟用/);assert.equal(calls,1);
 for(const text of ['not JSON',JSON.stringify({...draft,correct:0}),' '.repeat(18001)+JSON.stringify(draft)]){
  await assert.rejects(generateModelCase({},CASES[0],[],{...provider,async generate(){return {ok:true,value:{text}};}}),/格式不合格/);
 }
});

test('provider failures never leak upstream text or trigger retries',async()=>{
 for(const code of ['QUOTA','TIMEOUT','CANCELLED','NETWORK','PROVIDER_AUTH','OUTPUT_TRUNCATED','RESPONSE_TOO_LARGE']){
  let calls=0;const provider={async generate(){calls++;return {ok:false,code};}};
  await assert.rejects(generateModelCase({},CASES[0],[],provider),code==='QUOTA'?/額度/:/AI/);assert.equal(calls,1);
 }
 await assert.rejects(generateModelCase({},CASES[0],[],{async generate(){throw Error('PRIVATE_API_KEY');}}),{message:'AI 服務暫時無法生成案件。'});
});
