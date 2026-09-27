import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/providers/admission-scope.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {admissionScope}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const attempt={kind:'stage-dialogue',owner:'private-owner',sessionId:'private-session',requestKey:'7',issuedAt:86400000*20000+100};
test('scope uses original issuance timestamp and deterministic domain-separated hashes',async()=>{
 const a=await admissionScope(attempt),clock=Date.now;
 try{Date.now=()=>86400000*20002;assert.deepEqual(await admissionScope(attempt),a);}finally{Date.now=clock;}
 assert.match(a.id,/^20000:[a-f0-9]{64}$/);assert.match(a.userKey,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(a).includes('private-'));assert.notEqual(a.userKey,a.sessionKey);
 for(const change of [{kind:'npc'},{owner:'other'},{sessionId:'other'},{requestKey:'8'}]){
  assert.notEqual((await admissionScope({...attempt,...change})).id,a.id);
 }
 const other=await admissionScope({...attempt,kind:'npc',requestKey:'other'});
 assert.equal(other.userKey,a.userKey);assert.equal(other.sessionKey,a.sessionKey);
});
test('invalid attempts fail closed and object mutation cannot alter in-flight identity',async()=>{
 for(const change of [{issuedAt:NaN},{issuedAt:-1},{issuedAt:.5},{issuedAt:8e15+1},{kind:'unknown'},{owner:''},{sessionId:'x'.repeat(129)},{requestKey:null}])
  await assert.rejects(admissionScope({...attempt,...change}),/Invalid persisted AI attempt/);
 const copy={...attempt},pending=admissionScope(copy);copy.owner='changed';copy.issuedAt=0;
 assert.deepEqual(await pending,await admissionScope(attempt));
});
