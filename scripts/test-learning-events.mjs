import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import Ajv from 'ajv';
const built=await build({entryPoints:['src/learning-events.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {parseLearningEvent,parseLearningEventState,reduceLearningEvents:reduce,LEARNING_RETENTION_MS:TTL,LEARNING_MAX_EVENTS:MAX}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const schema=new Ajv({strict:true}).compile(JSON.parse(await readFile('contracts/learning-events-v1.schema.json','utf8')));
const policy={anonymousId:crypto.randomUUID(),conceptIds:new Set(['evidence-types'])};
const start=1800000000000;
const empty=()=>({schemaVersion:1,clock:start,events:[]});
const event=(kind='concept_mastery',occurredAt=start)=>({schemaVersion:1,eventVersion:1,eventId:crypto.randomUUID(),anonymousId:policy.anonymousId,
 occurredAt,kind,conceptId:kind==='completion'?null:'evidence-types',value:1,sampleSize:2});

test('six bounded learning measurements remain detached, deterministic and disabled by default',()=>{
 let state=empty();
 for(const kind of ['concept_mastery','repeated_error','evidence_reasoning_error','procedure_error','hint_dependency','completion']){
  const e=event(kind),old=structuredClone(state);
  assert.equal(reduce(state,e,start,policy).code,'DISABLED');
  const a=reduce(state,e,start,policy,true),b=reduce(state,e,start,policy,true);
  assert.equal(a.code,'ACCEPTED');assert.deepEqual(a,b);assert.deepEqual(state,old);
  assert.equal(schema(a.state),true);assert.deepEqual(parseLearningEventState(a.state,policy),a.state);
  e.value=0;assert.equal(a.state.events.at(-1).value,1);state=a.state;
 }
});
test('retries deduplicate; changed payload conflicts; full store cannot evict IDs to readmit repeats',()=>{
 const e=event();let state=reduce(empty(),e,start,policy,true).state;
 assert.equal(reduce(state,e,start,policy,true).code,'DUPLICATE');
 assert.equal(reduce(state,{...e,value:0},start,policy,true).code,'CONFLICT');
 state={...state,events:Array.from({length:MAX},()=>event())};
 assert.equal(schema(state),true);assert.equal(reduce(state,event(),start,policy,true).code,'FULL');
 assert.equal(reduce(state,state.events[0],start,policy,true).code,'DUPLICATE');
 const pruned=reduce(state,null,start+TTL,policy,true);
 assert.equal(pruned.code,'PRUNED');assert.equal(pruned.state.events.length,0);
 assert.equal(reduce(pruned.state,state.events[0],start+TTL,policy,true).code,'EXPIRED_EVENT');
 assert.equal(reduce(pruned.state,event('completion',start+TTL),start+TTL,policy,true).code,'ACCEPTED');
});
test('privacy and structural validation reject foreign scopes, unknown concepts, extra text and executable objects',()=>{
 for(const patch of [{anonymousId:crypto.randomUUID()},{conceptId:'person-name'},{text:'PRIVATE'},{accountId:'PRIVATE'},
  {kind:'custom'},{eventVersion:2},{occurredAt:NaN},{sampleSize:0},{sampleSize:1001},{value:3},{conceptId:null}]){
  assert.equal(parseLearningEvent({...event(),...patch},policy),null);
 }
 let calls=0;const e=event();Object.defineProperty(e,'value',{enumerable:true,get(){calls++;throw Error('private');}});
 assert.equal(parseLearningEvent(e,policy),null);assert.equal(calls,0);
 const state=empty();state.events=Array(1);assert.equal(parseLearningEventState(state,policy),null);
 assert.equal(parseLearningEventState({...empty(),events:[event(),event('completion',start+1)]},policy),null);
 assert.equal(reduce({...empty(),schemaVersion:2},event(),start,policy,true).state,null);
 assert.equal(reduce(empty(),event(),start-1,policy,true).code,'INVALID_STATE');
 assert.equal(reduce(empty(),event('completion',start+1),start,policy,true).code,'EXPIRED_EVENT');
});
test('retention remains bounded across simulated months and time rollback cannot resurrect data',()=>{
 let state=empty();
 for(let day=0;day<120;day++){
  const now=start+day*86400000;
  state=reduce(state,event('completion',now),now,policy,true).state;
  assert.ok(state.events.length<=30);assert.equal(schema(state),true);
  assert.deepEqual(parseLearningEventState(state,policy),state);
  assert.ok(state.events.every(e=>e.occurredAt>now-TTL));
 }
 assert.equal(reduce(state,null,start,policy,true).code,'INVALID_STATE');
});
