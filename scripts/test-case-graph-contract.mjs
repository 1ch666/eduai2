import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCaseGraph as authoring} from './case-graph-contract.mjs';
import {validateCaseGraph as runtime,parseCaseGraph} from '../src/case-graph.ts';
function validate(graph,policy){
 const result=runtime(graph,policy);
 assert.deepEqual(result,authoring(graph,policy),'runtime shape must match JSON schema');
 assert.deepEqual(parseCaseGraph(graph,policy),result.ok?graph:null,'parser must share acceptance and preserve content');
 return result;
}
const fixture=()=>({schemaVersion:1,facts:[{id:'f1'},{id:'f2'}],
 evidence:[{id:'e1',factIds:['f1']}],witnesses:[{id:'w1',factIds:['f2'],evidenceIds:['e1']}],
 timeline:[{id:'t1',order:0,factIds:['f1'],afterIds:[]},{id:'t2',order:1,factIds:['f2'],afterIds:['t1']}],legalSourceIds:['reviewed-source']});
const policy=['reviewed-source'];
test('valid graph is deterministic, immutable and independent simultaneous events are allowed',()=>{
 const graph=fixture(),before=structuredClone(graph);
 assert.deepEqual(validate(graph,policy),{ok:true});assert.deepEqual(validate(graph,policy),{ok:true});assert.deepEqual(graph,before);
 graph.timeline[1].afterIds=[];graph.timeline[1].order=0;assert.deepEqual(validate(graph,policy),{ok:true});
});
test('rejects duplicate node IDs and every typed dangling reference',()=>{
 for(const group of ['facts','evidence','witnesses','timeline']){const g=fixture();g[group].push(structuredClone(g[group][0]));assert.equal(validate(g,policy).code,'DUPLICATE_ID');}
 for(const group of ['evidence','witnesses','timeline']){const g=fixture();g[group][0].factIds=['missing'];assert.equal(validate(g,policy).code,'UNKNOWN_FACT');}
 const g=fixture();g.witnesses[0].evidenceIds=['f1'];assert.equal(validate(g,policy).code,'UNKNOWN_EVIDENCE');
 const h=fixture();h.timeline[1].afterIds=['missing'];assert.equal(validate(h,policy).code,'UNKNOWN_EVENT');
 const j=fixture();j.legalSourceIds=['model-invented'];assert.equal(validate(j,policy).code,'UNKNOWN_LEGAL_SOURCE');
});
test('rejects backwards, self, cyclic and equal-order dependencies',()=>{
 const backwards=fixture();backwards.timeline.reverse();assert.equal(validate(backwards,policy).code,'TIMELINE_ORDER');
 for(const id of ['t1','t2']){const g=fixture();g.timeline[0].afterIds=[id];assert.equal(validate(g,policy).code,'TIMELINE_DEPENDENCY');}
 const equal=fixture();equal.timeline[1].order=0;assert.equal(validate(equal,policy).code,'TIMELINE_DEPENDENCY');
});
test('schema fails closed for unknown authority, malformed fields and collection bounds',()=>{
 for(const value of [null,[],{},true,1])assert.equal(validate(value,policy).code,'GRAPH_SCHEMA');
 for(const key of ['score','truth','prompt','owner','stage'])assert.equal(validate({...fixture(),[key]:'untrusted'},policy).code,'GRAPH_SCHEMA');
 for(const key of Object.keys(fixture())){const g=fixture();delete g[key];assert.equal(validate(g,policy).code,'GRAPH_SCHEMA');}
 for(const order of [-1,1.5,NaN,Infinity,1000001]){const g=fixture();g.timeline[0].order=order;assert.equal(validate(g,policy).code,'GRAPH_SCHEMA');}
 const sparse=fixture();delete sparse.facts[0];assert.equal(validate(sparse,policy).code,'GRAPH_SCHEMA');
 for(const [key,limit] of [['facts',64],['evidence',32],['witnesses',16],['timeline',64]]){
  const g=fixture();g[key]=Array(limit+1).fill(g[key][0]);assert.equal(validate(g,policy).code,'GRAPH_SCHEMA');
 }
 assert.equal(validate(fixture(),['reviewed-source','reviewed-source']).code,'SOURCE_POLICY');
});

test('runtime/schema parity for seeded nested JSON mutations',()=>{
 let seed=0x20260928;
 const next=n=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%n;};
 const values=[null,false,0,1,-1,1.5,'',{},[],['f1','f1'],['missing'],['f1'],1000001];
 for(let i=0;i<1024;i++){
  const g=fixture(),group=['facts','evidence','witnesses','timeline'][next(4)];
  const key=Object.keys(g[group][0])[next(Object.keys(g[group][0]).length)];
  if(next(4)===0)delete g[group][0][key];else g[group][0][key]=structuredClone(values[next(values.length)]);
  validate(g,policy);
 }
});

test('runtime rejects non-JSON record prototypes and getters without executing them',()=>{
 assert.equal(runtime(Object.create(fixture()),policy).code,'GRAPH_SCHEMA');
 const g=fixture();Object.defineProperty(g,'facts',{get(){throw Error('not JSON');}});
 assert.equal(runtime(g,policy).code,'GRAPH_SCHEMA');
});

test('runtime rejects array accessors, inherited entries and custom iterators without executing them',()=>{
 for(const path of ['facts','evidence','witnesses','timeline','legalSourceIds','factIds','policy']){
  const g=fixture(),p=[...policy];
  const array=path==='policy'?p:path==='factIds'?g.evidence[0].factIds:g[path];
  Object.defineProperty(array,'0',{enumerable:true,get(){throw Error('array getter executed');}});
  assert.equal(runtime(g,p).code,path==='policy'?'SOURCE_POLICY':'GRAPH_SCHEMA');
  assert.equal(parseCaseGraph(g,p),null);
 }
 for(const key of [Symbol.iterator,'map','extra']){
  const g=fixture();Object.defineProperty(g.facts,key,{get(){throw Error('array hook executed');}});
  assert.equal(runtime(g,policy).code,'GRAPH_SCHEMA');
  assert.equal(parseCaseGraph(g,policy),null);
 }
 const g=fixture(),proto=Object.create(Array.prototype);
 Object.defineProperty(proto,'0',{get(){throw Error('inherited getter executed');}});
 delete g.facts[0];Object.setPrototypeOf(g.facts,proto);
 assert.equal(runtime(g,policy).code,'GRAPH_SCHEMA');
 assert.equal(parseCaseGraph(g,policy),null);
});

test('parsed graph is deeply detached in both directions and accepts frozen JSON',()=>{
 const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
 const original=deepFreeze(fixture()),parsed=parseCaseGraph(original,deepFreeze([...policy]));
 assert.deepEqual(parsed,original);
 const detached=(a,b)=>{if(a&&typeof a==='object'){assert.notEqual(a,b);for(const key of Object.keys(a))detached(a[key],b[key]);}};
 detached(parsed,original);
 parsed.witnesses[0].factIds.push('f1');parsed.timeline[1].afterIds.length=0;
 parsed.evidence[0].id='changed';parsed.legalSourceIds.length=0;
 assert.deepEqual(original,fixture());
 const mutable=fixture(),saved=parseCaseGraph(mutable,policy);
 mutable.facts[0].id='changed';mutable.evidence[0].factIds.length=0;
 mutable.witnesses[0].evidenceIds.length=0;mutable.timeline[0].order=99;
 mutable.timeline[1].afterIds.length=0;mutable.legalSourceIds.length=0;
 assert.deepEqual(saved,fixture());
});
