// Server-authoring contract checker. Never publish this graph to clients:
// references alone can reveal private facts or witness knowledge.
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
const ajv=new Ajv({strict:true,allErrors:false});
const schema=JSON.parse(await readFile(new URL('../contracts/case-graph-v1.schema.json',import.meta.url),'utf8'));
const shape=ajv.compile(schema);
const policyShape=ajv.compile({type:'array',maxItems:64,uniqueItems:true,items:schema.definitions.id});

export function validateCaseGraph(graph,allowedLegalSourceIds){
 if(!policyShape(allowedLegalSourceIds))return {ok:false,code:'SOURCE_POLICY'};
 if(!shape(graph))return {ok:false,code:'GRAPH_SCHEMA'};
 // IDs are unique within their typed namespace; references never cross types.
 for(const key of ['facts','evidence','witnesses','timeline'])
  if(new Set(graph[key].map(x=>x.id)).size!==graph[key].length)return {ok:false,code:'DUPLICATE_ID'};
 const facts=new Set(graph.facts.map(x=>x.id)),evidence=new Set(graph.evidence.map(x=>x.id));
 const timeline=new Map(graph.timeline.map(x=>[x.id,x.order]));
 for(const node of [...graph.evidence,...graph.witnesses,...graph.timeline])
  if(node.factIds.some(id=>!facts.has(id)))return {ok:false,code:'UNKNOWN_FACT'};
 for(const witness of graph.witnesses)
  if(witness.evidenceIds.some(id=>!evidence.has(id)))return {ok:false,code:'UNKNOWN_EVIDENCE'};
 let previous=-1;
 for(const event of graph.timeline){
  if(event.order<previous)return {ok:false,code:'TIMELINE_ORDER'};
  previous=event.order;
  for(const id of event.afterIds){
   if(!timeline.has(id))return {ok:false,code:'UNKNOWN_EVENT'};
   // Strict earlier-than dependencies reject cycles, self links and equal-time
   // dependencies. Independent equal-order events remain valid.
   if(timeline.get(id)>=event.order)return {ok:false,code:'TIMELINE_DEPENDENCY'};
  }
 }
 const sources=new Set(allowedLegalSourceIds);
 if(graph.legalSourceIds.some(id=>!sources.has(id)))return {ok:false,code:'UNKNOWN_LEGAL_SOURCE'};
 return {ok:true};
}
