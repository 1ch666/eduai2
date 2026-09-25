import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { CASES,newCourt } from '../src/court-rules.ts';
const bundle=await build({entryPoints:['src/court-npc.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {validNpcInput,npcKnowledge,renderNpcSelection,npcResponse}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const state=newCourt('test','owner',{caseId:CASES[0].id,role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'});
const input={requestId:crypto.randomUUID(),version:0,text:'你知道什麼？'};
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
  const env={COURT_AI_ENABLED:'true',OLLAMA_API_KEY:'fake-local-test'};
  assert.equal((await npcResponse(env,state,'Lawyer',input,true)).mode,'ai');
  globalThis.fetch=async()=>new Response('',{status:429});
  assert.equal((await npcResponse(env,state,'Lawyer',input,true)).errorCode,'QUOTA');
  globalThis.fetch=async()=>Response.json({message:{content:'{"text":"invented"}'}});
  assert.equal((await npcResponse(env,state,'Lawyer',input,true)).mode,'scripted');
 }finally{globalThis.fetch=original;}
});
