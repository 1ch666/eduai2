import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/court-dialogue.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {proposeStageDialogue}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const view={title:'虛構案件',procedure:'civil',stageLabel:'開庭',facts:['公開資料'],turn:{speaker:'法官',text:'請依序陳述。'},config:{role:'judge'},statements:['較早陳述','最後陳述'],privateGraph:'PRIVATE_CANARY',owner:'PRIVATE_OWNER'};
const success=text=>({ok:true,value:{text,usage:{inputTokens:null,outputTokens:null}}});
test('stage proposal uses normalized provider, only public fields, no mutation',async()=>{
 const before=structuredClone(view);let calls=0;
 const text=await proposeStageDialogue({async generate(input,context){
  calls++;assert.deepEqual(context,{timeoutMs:15000,maxResponseBytes:16384});
  assert.equal(input.output,'json');assert.equal(input.temperature,.3);assert.equal(input.maxOutputTokens,250);
  const payload=JSON.parse(input.messages[1].content);
  assert.deepEqual(payload,{caseTitle:view.title,procedure:'civil',stage:'開庭',speaker:'法官',facts:['公開資料'],scriptedLine:'請依序陳述。',playerRole:'judge',lastStatement:'最後陳述'});
  assert.ok(!JSON.stringify(input).includes('PRIVATE_'));
  return success(JSON.stringify({text:'請說明資料來源。',stage:99,score:999}));
 }},view);
 assert.equal(text,'請說明資料來源。');assert.equal(calls,1);assert.deepEqual(view,before);
});
test('malformed, empty, oversized and authority-only proposals fall back',async()=>{
 for(const text of ['null','[]','false','{}','bad JSON','{"text":7}','{"text":"   "}','{"stage":4}',JSON.stringify({text:'字'.repeat(241)}),' '.repeat(16385)+'{"text":"有效"}']){
  assert.equal(await proposeStageDialogue({async generate(){return success(text);}},view),null);
 }
 assert.equal(await proposeStageDialogue({async generate(){return success(JSON.stringify({text:'字'.repeat(240)}));}},view),'字'.repeat(240));
});
test('every provider failure and exception chooses fallback without retry or leakage',async()=>{
 for(const code of ['NOT_CONFIGURED','INVALID_INPUT','CANCELLED','TIMEOUT','NETWORK','QUOTA','PROVIDER_AUTH','MODEL_NOT_FOUND','UPSTREAM','RESPONSE_TOO_LARGE','INVALID_ENCODING','RESPONSE_FORMAT','OUTPUT_TRUNCATED','EMPTY_CONTENT']){
  let calls=0;assert.equal(await proposeStageDialogue({async generate(){calls++;return {ok:false,code};}},view),null);assert.equal(calls,1);
 }
 assert.equal(await proposeStageDialogue({async generate(){throw Error('PRIVATE_SECRET');}},view),null);
});
