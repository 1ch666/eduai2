import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import Ajv2020 from 'ajv/dist/2020.js';
const bundle=await build({entryPoints:['src/ai-outcome.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {aiOutcome}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const validate=new Ajv2020({strict:true}).compile(JSON.parse(readFileSync('contracts/ai-outcome-v1.schema.json','utf8')));
test('all feature/source combinations meet the formal outcome contract',()=>{
 for(const feature of ['tutor','photo','npc','stage-dialogue','case-generation']){
  for(const [source,mode] of Object.entries({model:'FULL',retrieval:'RAG_ONLY',scripted:'SCRIPTED_AI_FALLBACK',dictionary:'NO_AI',none:'NO_AI'})){
   const result=aiOutcome(feature,source);assert.equal(validate(result),true,JSON.stringify(validate.errors));
   assert.equal(result.mode,mode);assert.equal(result.modelUsed,source==='model');assert.equal(result.scope,'response');
  }
 }
});
test('schema rejects fabricated health, contradictory sources and private extras',()=>{
 const valid=aiOutcome('npc','scripted');
 for(const invalid of [{...valid,mode:'FULL'},{...valid,modelUsed:true},{...valid,scope:'platform'},
  {...valid,source:'dictionary',mode:'RAG_ONLY'},{...valid,providerHealth:'healthy'},
  {...valid,schemaVersion:2},{...valid,feature:'attacker'},{...valid,secret:'PRIVATE'}])assert.equal(validate(invalid),false);
});
