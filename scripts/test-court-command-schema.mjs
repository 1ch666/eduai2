import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
import {parseMutation,parseNotApplied} from '../court/protocol.js';

const schema=JSON.parse(await readFile(new URL('../contracts/court-v1-command.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv({strict:true,allErrors:true});
ajv.addSchema(schema);
const mutation=ajv.compile({$ref:schema.$id+'#/definitions/mutation'});
const receipt=ajv.compile({$ref:schema.$id+'#/definitions/notApplied'});
const sample=()=>({apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:crypto.randomUUID(),caseId:'sale',expectedStateVersion:0,actionId:'acknowledge',targetId:'',text:''});
test('standard command schema and runtime accept all boundary fixtures',()=>{
  for(const text of ['', '中'.repeat(600),'📖'.repeat(300)]){
    const value={...sample(),text,expectedStateVersion:Number.MAX_SAFE_INTEGER};
    assert.equal(mutation(value),true,JSON.stringify(mutation.errors));
    assert.ok(parseMutation(JSON.stringify(value)));
  }
  for(const reason of ['expired','state-changed']){
    const {apiVersion,requestId,sessionId,caseId}=sample();
    const value={apiVersion,requestId,sessionId,caseId,outcome:'not-applied',reason};
    assert.equal(receipt(value),true);assert.ok(parseNotApplied(JSON.stringify(value)));
    assert.equal(receipt({...value,text:'private'}),false);
    assert.equal(parseNotApplied(JSON.stringify({...value,text:'private'})),null);
  }
});
test('seeded malformed commands fail both schema and actual parser without altering source',()=>{
  let seed=20260928;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  const edits=[v=>v.apiVersion=2,v=>v.requestId='bad',v=>v.idempotencyKey=null,
    v=>v.sessionId='../../other',v=>v.expectedStateVersion=-1,
    v=>v.expectedStateVersion=0.5,v=>v.expectedStateVersion=9007199254740992,
    v=>v.caseId='',v=>v.actionId='x'.repeat(81),v=>v.targetId='https://evil.test',
    v=>v.text='中'.repeat(601),v=>v.hiddenTruth='private',v=>delete v.requestId];
  for(let i=0;i<512;i++){
    const original=sample(),value=structuredClone(original);edits[next()%edits.length](value);
    const before=JSON.stringify(value);
    assert.equal(mutation(value),false,`schema iteration ${i}`);
    assert.equal(parseMutation(before),null,`wire iteration ${i}`);
    assert.equal(JSON.stringify(value),before,'validator must not coerce or remove fields');
    assert.ok(parseMutation(JSON.stringify(original)));
  }
});
test('schema is explicitly not a replacement for the stricter raw wire parser',()=>{
  const value={...sample(),text:'📖'.repeat(301)};
  assert.equal(mutation(value),true);assert.equal(parseMutation(JSON.stringify(value)),null);
  const good=JSON.stringify(sample());
  for(const raw of [good.replace('"apiVersion":1','"apiVersion":1,"apiVersion":1'),
    good.replace('"expectedStateVersion":0','"expectedStateVersion":0e0'),
    good.replace('"text":""','"text":"\\ud800"')]){
    assert.equal(mutation(JSON.parse(raw)),true);
    assert.equal(parseMutation(raw),null);
  }
});
