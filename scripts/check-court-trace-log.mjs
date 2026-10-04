// Read only the disposable local CI log, never tail production or print payloads.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
const file=process.argv[2];if(!file)throw Error('Pass disposable local workerd log path');
const ajv=new Ajv({strict:true});
ajv.addSchema(JSON.parse(await readFile(new URL('../contracts/trace-context-v1.schema.json',import.meta.url),'utf8')));
const validate=ajv.compile(JSON.parse(await readFile(new URL('../contracts/court-action-trace-v1.schema.json',import.meta.url),'utf8')));
// A completed HTTP client can exit just before piped stdout flushes. Bounded
// polling waits only for logs, never supplies concurrency protection to code.
let passed=false;
for(let attempt=0;attempt<20;attempt++){
 const log=await readFile(file,'utf8');assert(log.length<8*1024*1024,'unexpectedly large local log');
 const records=log.split(/\r?\n/).flatMap(line=>{
  const start=line.indexOf('{');if(start<0)return [];
  try{return [JSON.parse(line.slice(start).replace(/\x1b\[[0-9;]*m/g,''))];}catch{return [];}
 });
 const actions=records.filter(r=>r.event==='court.action.completed');
 const http=records.filter(r=>r.event==='http.request.completed');
 for(const action of actions)assert(validate(action),'court trace violates bounded schema');
 passed=['legacy','versioned'].every(api=>[200,409].every(status=>actions.some(r=>r.interface===api&&r.status===status)))&&
  actions.every(a=>http.some(h=>h.requestId===a.requestId&&h.traceId===a.traceId&&h.status===a.status));
 if(passed)break;
 await new Promise(resolve=>setTimeout(resolve,100));
}
assert(passed,'local court action traces missing or not correlated to HTTP completion');
console.log('Local court traces passed: legacy/versioned 200/409, bounded schema and HTTP correlation.');
