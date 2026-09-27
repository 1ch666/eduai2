// Server-only contract. No eval, schema compiler, network or storage at runtime.
export interface CaseGraph {
  schemaVersion: 1;
  facts: {id: string}[];
  evidence: {id: string; factIds: string[]}[];
  witnesses: {id: string; factIds: string[]; evidenceIds: string[]}[];
  timeline: {id: string; order: number; factIds: string[]; afterIds: string[]}[];
  legalSourceIds: string[];
}
export type GraphResult = {ok:true} | {ok:false; code:'SOURCE_POLICY'|'GRAPH_SCHEMA'|
  'DUPLICATE_ID'|'UNKNOWN_FACT'|'UNKNOWN_EVIDENCE'|'UNKNOWN_EVENT'|
  'TIMELINE_ORDER'|'TIMELINE_DEPENDENCY'|'UNKNOWN_LEGAL_SOURCE'};
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v);
function list<T>(v:unknown,max:number,check:(item:unknown)=>item is T,min=0):v is T[]{
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||
    v.length<min||v.length>max||Reflect.ownKeys(v).length!==v.length+1)return false;
  // Do not execute input iterators/accessors. Only dense, plain JSON arrays.
  for(let i=0;i<v.length;i++){
    const item=Object.getOwnPropertyDescriptor(v,String(i));
    if(!item||!('value' in item)||!item.enumerable||!check(item.value))return false;
  }
  return true;
}
function refs(v:unknown):v is string[]{return list(v,64,id)&&new Set(v).size===v.length;}
function record(v:unknown,keys:string[]):v is Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v))return false;
  const prototype=Object.getPrototypeOf(v);
  if(prototype!==Object.prototype&&prototype!==null)return false;
  return Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{
    const d=Object.getOwnPropertyDescriptor(v,k);return d!==undefined&&'value' in d&&d.enumerable;
  });
}
function fact(v:unknown):v is CaseGraph['facts'][number]{return record(v,['id'])&&id(v.id);}
function evidence(v:unknown):v is CaseGraph['evidence'][number]{return record(v,['id','factIds'])&&id(v.id)&&refs(v.factIds);}
function witness(v:unknown):v is CaseGraph['witnesses'][number]{return record(v,['id','factIds','evidenceIds'])&&id(v.id)&&refs(v.factIds)&&refs(v.evidenceIds);}
function event(v:unknown):v is CaseGraph['timeline'][number]{
  return record(v,['id','order','factIds','afterIds'])&&id(v.id)&&typeof v.order==='number'&&
    Number.isInteger(v.order)&&v.order>=0&&v.order<=1000000&&refs(v.factIds)&&refs(v.afterIds);
}
function graphShape(v:unknown):v is CaseGraph{
  return record(v,['schemaVersion','facts','evidence','witnesses','timeline','legalSourceIds'])&&v.schemaVersion===1&&
    list(v.facts,64,fact,1)&&list(v.evidence,32,evidence)&&list(v.witnesses,16,witness)&&
    list(v.timeline,64,event)&&refs(v.legalSourceIds);
}
export function validateCaseGraph(value:unknown,allowedLegalSourceIds:unknown):GraphResult{
  if(!refs(allowedLegalSourceIds))return {ok:false,code:'SOURCE_POLICY'};
  if(!graphShape(value))return {ok:false,code:'GRAPH_SCHEMA'};
  return validateGraphRelations(value,allowedLegalSourceIds);
}

// A validated, detached value for a future trusted storage boundary. Never
// retain the caller's mutable graph or publish these private relationships.
export function parseCaseGraph(value:unknown,allowedLegalSourceIds:unknown):CaseGraph|null{
  if(!refs(allowedLegalSourceIds)||!graphShape(value)||
    !validateGraphRelations(value,allowedLegalSourceIds).ok)return null;
  return {
    schemaVersion:1,
    facts:value.facts.map(f=>({id:f.id})),
    evidence:value.evidence.map(e=>({id:e.id,factIds:[...e.factIds]})),
    witnesses:value.witnesses.map(w=>({id:w.id,factIds:[...w.factIds],evidenceIds:[...w.evidenceIds]})),
    timeline:value.timeline.map(e=>({id:e.id,order:e.order,factIds:[...e.factIds],afterIds:[...e.afterIds]})),
    legalSourceIds:[...value.legalSourceIds],
  };
}

// Shared with the schema-based authoring checker. Caller must validate shapes.
export function validateGraphRelations(graph:CaseGraph,allowedLegalSourceIds:readonly string[]):GraphResult{
  for(const key of ['facts','evidence','witnesses','timeline'] as const)
    if(new Set(graph[key].map(x=>x.id)).size!==graph[key].length)return {ok:false,code:'DUPLICATE_ID'};
  const facts=new Set(graph.facts.map(x=>x.id)),evidence=new Set(graph.evidence.map(x=>x.id));
  const timeline=new Map(graph.timeline.map(x=>[x.id,x.order]));
  for(const node of [...graph.evidence,...graph.witnesses,...graph.timeline])
    if(node.factIds.some(x=>!facts.has(x)))return {ok:false,code:'UNKNOWN_FACT'};
  for(const w of graph.witnesses)
    if(w.evidenceIds.some(x=>!evidence.has(x)))return {ok:false,code:'UNKNOWN_EVIDENCE'};
  let previous=-1;
  for(const e of graph.timeline){
    if(e.order<previous)return {ok:false,code:'TIMELINE_ORDER'};
    previous=e.order;
    for(const target of e.afterIds){
      if(!timeline.has(target))return {ok:false,code:'UNKNOWN_EVENT'};
      if(timeline.get(target)!>=e.order)return {ok:false,code:'TIMELINE_DEPENDENCY'};
    }
  }
  const sources=new Set(allowedLegalSourceIds);
  if(graph.legalSourceIds.some(x=>!sources.has(x)))return {ok:false,code:'UNKNOWN_LEGAL_SOURCE'};
  return {ok:true};
}
