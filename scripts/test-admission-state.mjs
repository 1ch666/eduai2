import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv';
import {emptyAdmission,reduceAdmission} from '../src/providers/admission.ts';
import {parseAdmissionState} from '../src/providers/admission-state.ts';
const schema=new Ajv({strict:true}).compile(JSON.parse(readFileSync(new URL('../contracts/ai-admission-v1-state.schema.json',import.meta.url),'utf8')));
const policy={concurrency:2,queue:2,daily:20,userDaily:10,sessionDaily:5,queueMs:5000,leaseMs:10000,
 failureThreshold:2,cooldownMs:1000,quotaCooldownMs:2000,maxRecords:100};
const command=id=>({type:'admit',request:{id,fingerprint:'hash',userKey:'user',sessionKey:'session'}});
const fixture=()=>reduceAdmission(emptyAdmission(),command('one'),100,policy,true).state;
test('admission restore returns a copy, accepts schema-valid real phases and preserves unknown counts',()=>{
 for(const command of [{type:'tick'},{type:'cancel',id:'one'},
  ...['success','failure','quota'].map(outcome=>({type:'finish',id:'one',outcome,usage:{inputTokens:null,outputTokens:4}}))]){
  const state=reduceAdmission(fixture(),command,101,policy,true).state;
  assert.equal(schema(state),true);const parsed=parseAdmissionState(state);assert.deepEqual(parsed,state);
  parsed.records[0].id='changed';assert.equal(state.records[0].id,'one');
 }
 const unknown=reduceAdmission(fixture(),{type:'tick'},10100,policy,true).state;
 assert.equal(schema(unknown),true);assert.deepEqual(parseAdmissionState(unknown),unknown);
 assert.equal(unknown.records[0].phase,'unknown');assert.equal(unknown.records[0].usage,null);
});
test('admission restore rejects wrong versions, missing/extra fields and invalid numeric shapes',()=>{
 for(const mutate of [s=>s.schemaVersion=2,s=>delete s.failures,s=>s.secret='no',s=>s.clock=NaN,
  s=>s.failures=101,s=>s.circuitVersion=.5,s=>s.records[0].deadline=Infinity,
  s=>s.records[0].id='',s=>s.records[0].userKey='contains space',s=>s.records[0].usage={},
  s=>s.records[0].phase='invented',s=>s.records[0].extra='no']){
  const s=fixture();mutate(s);assert.equal(parseAdmissionState(s),null);
 }
 for(const v of [null,[],{},'{}',false])assert.equal(parseAdmissionState(v),null);
});
test('admission restore checks relationships beyond the machine shape schema',()=>{
 for(const mutate of [s=>s.records.push({...s.records[0]}),s=>s.records[0].day=1,
  s=>s.records[0].created=101,s=>s.records[0].deadline=100,s=>s.records[0].circuitVersion=1,
  s=>s.records[0].phase='succeeded',s=>s.records[0].outcome='success',s=>s.openUntil=200,
  s=>s.records[0].deadline=120101]){
  const s=fixture();mutate(s);assert.equal(schema(s),true);assert.equal(parseAdmissionState(s),null);
 }
 const reversed=reduceAdmission(fixture(),command('two'),101,policy,true).state;
 reversed.records.reverse();assert.equal(parseAdmissionState(reversed),null);
});
test('admission restore does not invoke accessors, iterators, inherited data or accept sparse arrays',()=>{
 let touched=0;
 const getter=()=>{touched++;throw Error('must not run');};
 const root=fixture();Object.defineProperty(root,'clock',{get:getter,enumerable:true});
 assert.equal(parseAdmissionState(root),null);
 const row=fixture();Object.defineProperty(row.records[0],'id',{get:getter,enumerable:true});
 assert.equal(parseAdmissionState(row),null);
 const array=fixture();Object.defineProperty(array.records,'0',{get:getter,enumerable:true});
 assert.equal(parseAdmissionState(array),null);
 const iterator=fixture();iterator.records[Symbol.iterator]=getter;assert.equal(parseAdmissionState(iterator),null);
 const inherited=fixture();Object.setPrototypeOf(inherited.records[0],{hidden:true});assert.equal(parseAdmissionState(inherited),null);
 const sparse=fixture();sparse.records=new Array(2);assert.equal(parseAdmissionState(sparse),null);
 assert.equal(touched,0);
});
test('shape validator and runtime agree on 512 seeded field mutations; accepted values remain isolated',()=>{
 let seed=1892;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>8;};
 const fields=['id','fingerprint','userKey','sessionKey','day','created','deadline','phase','circuitVersion','outcome','usage'];
 const values=[null,true,false,0,-1,.5,'','safe','success',[],{},100,10100];
 for(let i=0;i<512;i++){
  const s=fixture();s.records[0][fields[next()%fields.length]]=structuredClone(values[next()%values.length]);
  const parsed=parseAdmissionState(s);
  if(parsed){assert.equal(schema(parsed),true);assert.deepEqual(parsed,s);}
  if(!schema(s))assert.equal(parsed,null);
 }
});
