// Server-authoring contract checker. Never publish this graph to clients:
// references alone can reveal private facts or witness knowledge.
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
import {validateGraphRelations} from '../src/case-graph.ts';
const ajv=new Ajv({strict:true,allErrors:false});
const schema=JSON.parse(await readFile(new URL('../contracts/case-graph-v1.schema.json',import.meta.url),'utf8'));
const shape=ajv.compile(schema);
const policyShape=ajv.compile({type:'array',maxItems:64,uniqueItems:true,items:schema.definitions.id});

export function validateCaseGraph(graph,allowedLegalSourceIds){
 if(!policyShape(allowedLegalSourceIds))return {ok:false,code:'SOURCE_POLICY'};
 if(!shape(graph))return {ok:false,code:'GRAPH_SCHEMA'};
 return validateGraphRelations(graph,allowedLegalSourceIds);
}
