import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
async function module(path){const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'do',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject {}'}));}}]});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));}
const {aiAvailability}=await module('src/ai-availability.ts');
const {default:worker}=await module('src/index.ts');
const status=code=>({schemaVersion:1,scope:'provider-account',checkedAt:Date.now(),code,canAttempt:code==='READY',providerHealth:'not-probed'});
const env=inspect=>({AI_ADMISSION_ENABLED:'true',OLLAMA_API_KEY:'PRIVATE_KEY',AI_ADMISSION:{getByName(name){assert.equal(name,'ollama-account-v1');return {inspect};}}});
test('configuration shortcuts do not call storage; unknown storage fails closed',async()=>{
 const never=()=>{throw Error('must not query');};
 assert.equal((await aiAvailability({...env(never),OLLAMA_API_KEY:''})).reason,'NOT_CONFIGURED');
 assert.equal((await aiAvailability({...env(never),AI_ADMISSION_ENABLED:'false'})).reason,'DISABLED');
 assert.equal((await aiAvailability(env(()=>{throw Error('PRIVATE');}))).reason,'UNAVAILABLE');
 assert.equal((await aiAvailability({...env(never),AI_ADMISSION:undefined})).reason,'UNAVAILABLE');
});
test('receipt parsing rejects incompatible shape and projects away all private data',async()=>{
 const schema=JSON.parse(readFileSync('contracts/ai-availability-v1.schema.json','utf8'));
 for(const code of ['READY','DISABLED','CIRCUIT_OPEN','BUDGET','QUEUE_FULL','CAPACITY']){
  const result=await aiAvailability(env(async()=>({...status(code),records:[{owner:'PRIVATE'}],secret:'PRIVATE'})));
  assert.equal(result.reason,code);assert.equal(result.canAttempt,code==='READY');
  assert.equal(result.providerHealth,'not-probed');assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.deepEqual(Object.keys(result).sort(),[...schema.required].sort());
 }
 for(const receipt of [null,{},status('invented'),{...status('READY'),schemaVersion:2},{...status('READY'),canAttempt:false},
  {...status('READY'),providerHealth:'healthy'},{...status('READY'),checkedAt:NaN}])
   assert.equal((await aiAvailability(env(async()=>receipt))).reason,'UNAVAILABLE');
});
test('hung status RPC times out and late success cannot change the returned decision',async()=>{
 let release;const result=await aiAvailability(env(()=>new Promise(r=>release=r)));
 assert.equal(result.reason,'UNAVAILABLE');release(status('READY'));await new Promise(r=>setImmediate(r));
 assert.equal(result.canAttempt,false);
});
test('real Worker routing preserves non-AI capabilities, gives consistent status and never calls inference',async()=>{
 const old=globalThis.fetch,log=console.log;let calls=0;console.log=()=>{};
 globalThis.fetch=async()=>{calls++;throw Error('must not call model');};
 try{
  for(const code of ['READY','DISABLED','CIRCUIT_OPEN','BUDGET','QUEUE_FULL','CAPACITY']){
   const e={...env(async()=>status(code)),COURT_AI_ENABLED:'true'};
   for(const path of ['/api/capabilities','/api/ai/status','/api/photo/status']){
    const response=await worker.fetch(new Request('https://local.test'+path),e);assert.equal(response.status,200);
    assert.equal(response.headers.get('Cache-Control'),'no-store');assert.ok(response.headers.get('X-Request-Id'));
    const body=await response.json();assert.equal(body.availability.reason,code);
    if(path==='/api/capabilities'){
     for(const feature of ['textAi','courtAi','npcAi','caseGenerationAi','photo'])assert.equal(body[feature],code==='READY');
     for(const feature of ['auth','court','practice','planner','rankings','groups'])assert.equal(body[feature],true);
    }else assert.equal(body.available,code==='READY');
    if(path==='/api/photo/status')assert.equal(body.ocrAvailable,false);
   }
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=old;console.log=log;}
});
