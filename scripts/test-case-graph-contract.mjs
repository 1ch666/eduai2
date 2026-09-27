import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCaseGraph as validate} from './case-graph-contract.mjs';
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
