// Test/build tooling only. Ajv is not shipped to the browser or Worker.
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
const ajv=new Ajv({strict:true,allErrors:true});
for(const name of ['command','state']){
  const schema=JSON.parse(await readFile(new URL(`../contracts/court-v1-${name}.schema.json`,import.meta.url),'utf8'));
  ajv.addSchema(schema);
}
for(const name of ['trace-context-v1','court-v2-events','court-v2-response'])ajv.addSchema(JSON.parse(await readFile(new URL(`../contracts/${name}.schema.json`,import.meta.url),'utf8')));
export const courtV2Events=ajv.getSchema('urn:eduai:court:v2:events');
export const courtV2Response=ajv.getSchema('urn:eduai:court:v2:response');
export const courtSchemas=Object.fromEntries([
  ['mutation','command'],['notApplied','command'],['snapshot','state'],['event','state'],['eventPage','state']
].map(([kind,group])=>[kind,ajv.compile({$ref:`urn:eduai:court:v1:${group}#/definitions/${kind}`})]));
export function assertCourtSchema(kind,value){
  const check=courtSchemas[kind];
  if(!check)throw Error('Unknown court schema kind');
  // Do not print private payloads/values in test logs on failure.
  if(!check(value))throw Error(`Court ${kind} schema failed: ${check.errors.map(e=>e.instancePath+':'+e.keyword).join(', ')}`);
}
