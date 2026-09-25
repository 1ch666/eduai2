// Disposable LOCAL accounts only. Run with COURT_AI_ENABLED:false.
import assert from 'node:assert/strict';
const base=process.argv[2];
assert.ok(base&&['127.0.0.1','localhost'].includes(new URL(base).hostname));
async function call(path,body,auth={}){
 const r=await fetch(base+path,{method:body?'POST':'GET',signal:AbortSignal.timeout(20000),headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json();return {status:r.status,data,cookie:r.headers.getSetCookie().find(s=>s.startsWith('civic_session='))?.split(';')[0],csrf:data.csrfToken};
}
const register=()=>call('/api/auth/register',{username:'npc_'+crypto.randomUUID().slice(0,8),password:'local-test-password-2026',displayName:'本機 NPC 測試'});
const a=await register(),b=await register();assert.equal(a.status,201);assert.equal(b.status,201);
const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
const created=await call('/api/court/sessions',config,a);assert.equal(created.status,201);
const route='/api/court/sessions/'+created.data.view.id,npc=route+'/npcs/Witness/messages';
const input={requestId:crypto.randomUUID(),version:0,text:'你親眼看到什麼？'};
assert.equal((await call(npc,input)).status,401);
assert.equal((await call(npc,input,{cookie:a.cookie})).status,403);
assert.equal((await call(npc,input,b)).status,404);
assert.equal((await call(npc,{...input,text:'中'.repeat(401)},a)).status,400);
const first=await call(npc,input,a);assert.equal(first.status,200,JSON.stringify(first.data));assert.equal(first.data.reply.mode,'scripted');
assert.deepEqual((await call(npc,{...input,owner:'injected',npcId:'Judge'},a)).data,first.data);
assert.equal((await call(npc,{...input,text:'different'},a)).status,409);
assert.equal((await call(npc,{...input,requestId:crypto.randomUUID()},a)).status,409);
const restored=await call(route,undefined,a);assert.equal(restored.data.view.version,1);assert.equal(restored.data.view.npcHistory.length,1);assert.equal(restored.data.view.npcHistory[0].question,input.text);
assert.equal((await call(route,undefined,b)).status,404);
const ids=new Set();
for(let i=0;i<3;i++){
 const request={...config,requestId:crypto.randomUUID()};
 const result=await call('/api/court/cases/generate',request,a);assert.equal(result.status,201,JSON.stringify(result.data));
 ids.add(result.data.view.title);assert.equal(result.data.view.evidence.length,created.data.view.evidence.length+1);
 assert.ok(!('generatedCase' in result.data.view));assert.ok(!('correct' in result.data.view));
 if(i===0)assert.deepEqual((await call('/api/court/cases/generate',request,a)).data,result.data);
}
assert.equal(ids.size,3);
// Different account has its own non-repetition history, never shares private saves.
const other=await call('/api/court/cases/generate',{...config,requestId:crypto.randomUUID()},b);assert.equal(other.status,201);
console.log('NPC local integration passed: auth, CSRF, ownership, Chinese, length, replay/projection, stale version, restore, unique evidence variations and private history.');
