import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { CASES,newCourt } from '../src/court-rules.ts';
import { npcNotice } from '../court/npc-status.js';
const bundle=await build({entryPoints:['src/court-npc.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {validNpcInput,npcKnowledge,npcHistory,renderNpcSelection,renderNpcDialogue,npcResponse}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const state=newCourt('test','owner',{caseId:CASES[0].id,role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'});
const input={requestId:crypto.randomUUID(),version:0,text:'你知道什麼？'};
test('history stays within role, bounded, and does not train on fallback replies',()=>{
 const row=(id,mode='ai')=>({payload:JSON.stringify({npcId:id,text:'一台二手相機'}),result:JSON.stringify({npcId:id,mode,text:'請確認是哪項交易爭議。'})});
 const h=npcHistory([row('Judge'),row('Lawyer','scripted'),row('Lawyer')],'Lawyer');
 assert.equal(h.length,2);assert.equal(h[0].answer,'');assert.equal(h[1].question,'一台二手相機');
 assert.equal(npcHistory(Array.from({length:10},()=>row('Lawyer')),'Lawyer').length,4);
});
test('cloud request is compatible, has conversation context, and accepts fenced JSON greetings',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(_url,options)=>{
   const body=JSON.parse(options.body);assert.equal(body.format,undefined);assert.equal(body.think,'low');
   const data=JSON.parse(body.messages[1].content);assert.equal(data.history[0].question,'一台二手相機');
   return Response.json({message:{content:'```json\n{"reply":"你好，你想詢問這筆交易的哪個部分？","factIds":[],"uncertain":true}\n```'}});
  };
  const r=await npcResponse({OLLAMA_API_KEY:'local-test'},state,'Lawyer',{...input,text:'嗨'},true,[{question:'一台二手相機',answer:''}]);
  assert.equal(r.mode,'ai');assert.ok(r.text.startsWith('你好'));
 }finally{globalThis.fetch=old;}
});
test('failure classes are distinct and logs contain no questions, secrets or raw provider text',async()=>{
 const old=globalThis.fetch,oldWarn=console.warn,logs=[];console.warn=line=>logs.push(line);
 const scenarios=[
  ['TIMEOUT',()=>{throw new DOMException('private response','TimeoutError');}],
  ['NETWORK',()=>{throw new TypeError('private response');}],
  ['PROVIDER_AUTH',()=>new Response('secret',{status:401})],
  ['MODEL_NOT_FOUND',()=>new Response('secret',{status:404})],
  ['ENVELOPE_JSON',()=>new Response('secret')],
  ['EMPTY_CONTENT',()=>Response.json({message:{content:'',thinking:'private reasoning'}})],
  ['OUTPUT_TRUNCATED',()=>Response.json({done_reason:'length',message:{content:'{unfinished'}})],
  ['CONTENT_JSON',()=>Response.json({message:{content:'not json'}})],
  ['CONTENT_SCHEMA',()=>Response.json({message:{content:'{"reply":"無引用","uncertain":false,"factIds":[]}'}})],
 ];
 try{for(const [code,fn] of scenarios){globalThis.fetch=async()=>fn();const r=await npcResponse({OLLAMA_API_KEY:'secret'},state,'Lawyer',input,true);
  assert.equal(r.errorCode,code);assert.equal(r.mode,'scripted');assert.ok(r.text.includes('沒有新增角色證詞'));assert.ok(npcNotice(r).includes(code));
 }}finally{globalThis.fetch=old;console.warn=oldWarn;}
 for(const log of logs)assert.ok(!/private|secret|你知道|thinking/.test(log));
});
test('generated evidence IDs do not hide labelled witness statements; unknown sight is explicit',()=>{
 const generated={...CASES[0],evidence:[{id:'generated-0',title:'證人陳述',text:'證人只見到交接，沒有看到拆開包裹。'}]};
 assert.ok(npcKnowledge({...state,generatedCase:generated},'Witness').facts[0].text.includes('沒有看到拆開包裹'));
 generated.evidence=[{id:'generated-0',title:'交易單據',text:'尚未確認簽名來源。'}];
 assert.ok(npcKnowledge({...state,generatedCase:generated},'Witness').facts[0].text.includes('未提供屬於我的親眼見聞'));
});
test('natural dialogue requires known fact references and bounded plain text',()=>{
 const k=npcKnowledge(state,'Witness');
 assert.equal(renderNpcDialogue({reply:'我只能說明記錄中的片段，不能補猜未見部分。',factIds:['k0'],uncertain:false},k).knowledgeIds[0],'k0');
 for(const v of [{reply:'未引用資料',factIds:[],uncertain:false},{reply:'<script>bad</script>',factIds:['k0'],uncertain:false},{reply:'民法第1條',factIds:['k0'],uncertain:false},{reply:'捏造',factIds:['absent'],uncertain:false}])assert.equal(renderNpcDialogue(v,k),null);
});
test('NPC validator rejects oversized, blank and invalid versions',()=>{
 assert.ok(validNpcInput(input));
 for(const delta of [{text:' '},{text:'中'.repeat(401)},{version:-1},{version:Infinity},{requestId:'fake'}])assert.equal(validNpcInput({...input,...delta}),false);
});
test('model output cannot introduce facts, markup or arbitrary fields',()=>{
 const k=npcKnowledge(state,'Lawyer');
 for(const data of [{factIds:['invented'],uncertain:false},{factIds:[],uncertain:false,text:'判決有罪'},{factIds:['k0'],uncertain:'false'},null])assert.equal(renderNpcSelection(data,k),null);
 assert.equal(renderNpcSelection({factIds:['k0','k0'],uncertain:false},k).text,k.facts[0].text);
 assert.equal(renderNpcSelection({factIds:['k0'],uncertain:true},k).text,k.unknown);
});
test('disabled AI never calls provider; valid selection and failures are bounded',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({message:{content:JSON.stringify({factIds:['k0'],uncertain:false})}});};
  assert.equal((await npcResponse({},state,'Lawyer',input,true)).mode,'scripted');assert.equal(calls,0);
  const env={OLLAMA_API_KEY:'fake-local-test'};
  assert.equal((await npcResponse({...env,COURT_AI_ENABLED:'false'},state,'Lawyer',input,true)).mode,'scripted');assert.equal(calls,0);
  assert.equal((await npcResponse(env,state,'Lawyer',input,false)).errorCode,'RATE_LIMIT');assert.equal(calls,0);
  assert.equal((await npcResponse(env,state,'Lawyer',input,true)).mode,'ai');
  globalThis.fetch=async()=>Response.json({message:{content:JSON.stringify({reply:'請先核對資料來源，不要把推論當成事實。',factIds:['k0'],uncertain:false})}});
  assert.equal((await npcResponse(env,state,'Lawyer',input,true)).text,'請先核對資料來源，不要把推論當成事實。');
  globalThis.fetch=async()=>new Response('',{status:429});
  assert.equal((await npcResponse(env,state,'Lawyer',input,true)).errorCode,'QUOTA');
  globalThis.fetch=async()=>Response.json({message:{content:'{"text":"invented"}'}});
  assert.equal((await npcResponse(env,state,'Lawyer',input,true)).mode,'scripted');
 }finally{globalThis.fetch=original;}
});
