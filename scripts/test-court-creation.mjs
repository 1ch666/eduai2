import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {courtV2Create} from './court-schema-check.mjs';
const bundle=await build({entryPoints:['src/court-creation.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {parseCreation}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
const command=()=>({apiVersion:2,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:crypto.randomUUID(),expectedStateVersion:0,config});
test('creation contract and strict parser accept legal configuration without losing command identity',()=>{
 const c=command(),parsed=parseCreation(JSON.stringify(c));
 assert.equal(courtV2Create(c),true,JSON.stringify(courtV2Create.errors));
 assert.deepEqual(JSON.parse(JSON.stringify(parsed)),c);
 assert.equal(Object.getPrototypeOf(parsed.config),Object.prototype,'Cloudflare RPC requires a plain configuration record');
});
test('creation rejects hidden state, duplicate keys, malformed wire and invalid legal configurations',()=>{
 const c=command(),raw=JSON.stringify(c);
 for(const value of [{...c,owner:'admin'},{...c,expectedStateVersion:1},{...c,sessionId:'invalid'},
  {...c,config:{...config,score:100}},{...c,config:{...config,role:'respondentCounsel'}},
  {...c,config:{...config,claimantAge:91}},{...c,config:{...config,caseId:'youth-property',role:'observer'}},
  {...c,config:null},{...c,config:[]}])assert.equal(parseCreation(JSON.stringify(value)),null);
 for(const bad of [raw.replace('"apiVersion":2','"apiVersion":2,"apiVersion":2'),
  raw.replace('"role":"judge"','"role":"judge","role":"judge"'),
  raw.replace('"expectedStateVersion":0','"expectedStateVersion":-0'),
  raw.replace('"claimantAge":20','"claimantAge":2e1'),raw+' ',raw]){
  if(bad===raw||bad===raw+' ')assert.ok(parseCreation(bad));else assert.equal(parseCreation(bad),null);
 }
 assert.equal(parseCreation(' '.repeat(4097)),null);
});
