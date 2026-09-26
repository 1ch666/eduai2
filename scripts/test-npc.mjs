import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { CASES,newCourt } from '../src/court-rules.ts';
const bundle=await build({entryPoints:['src/court-npc.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {validNpcInput,npcKnowledge,renderNpcSelection,renderNpcDialogue,npcResponse}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const state=newCourt('test','owner',{caseId:CASES[0].id,role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'});
const input={requestId:crypto.randomUUID(),version:0,text:'你知道什麼？'};
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
