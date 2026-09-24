// Local integration only: creates disposable accounts, never uses production.
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:8790';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
async function call(path, body, auth = {}) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(15000),
    headers: { Origin: base, ...(body ? {'Content-Type':'application/json'} : {}),
      ...(auth.cookie ? {Cookie:auth.cookie} : {}), ...(auth.csrf ? {'X-CSRF-Token':auth.csrf} : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  const cookie = response.headers.getSetCookie().find(x=>x.startsWith('civic_session='))?.split(';')[0];
  return { status:response.status, data, cookie, csrf:data.csrfToken };
}
const username = 'court_' + crypto.randomUUID().slice(0,8);
const password = 'local-safe-check-2026';
const a = await call('/api/auth/register', {username,password,displayName:'本機測試'});
assert.equal(a.status,201); assert.match(a.data.recoveryCode,/^[a-f0-9]{64}$/);
const b = await call('/api/auth/register', {username:username+'b',password,displayName:'本機測試B'});
assert.equal(b.status,201);
const config = {caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
assert.equal((await call('/api/court/sessions',config)).status,401);
assert.equal((await call('/api/court/sessions',config,{cookie:a.cookie})).status,403);
const created=await call('/api/court/sessions',config,a);
assert.equal(created.status,201,JSON.stringify(created.data));
const route='/api/court/sessions/'+created.data.view.id;
assert.equal((await call(route,undefined,b)).status,404);
assert.equal((await call(route+'/actions',{requestId:crypto.randomUUID(),version:0,type:'acknowledge'},b)).status,404);
const action={requestId:crypto.randomUUID(),version:0,type:'acknowledge'};
const first=await call(route+'/actions',action,a);
assert.equal(first.status,200);
assert.deepEqual((await call(route+'/actions',action,a)).data,first.data);
assert.equal((await call(route+'/actions',{...action,type:'speak',text:'changed'},a)).status,409);
assert.equal((await call(route+'/actions',{...action,requestId:crypto.randomUUID()},a)).status,409);
assert.equal((await call(route+'/actions',{requestId:crypto.randomUUID(),version:1,type:'answer',answer:1},a)).status,409);
const restored=await call(route,undefined,a);
assert.equal(restored.data.view.version,1);
const fallback=await call(route+'/dialogue',{},a);
assert.equal(fallback.status,200); assert.equal(fallback.data.mode,'scripted');
const recovered=await call('/api/auth/recover',{username,password:'replacement-safe-password',recoveryCode:a.data.recoveryCode});
assert.equal(recovered.status,200,JSON.stringify(recovered.data));
assert.notEqual(recovered.data.recoveryCode,a.data.recoveryCode);
assert.equal((await call('/api/auth/session',undefined,a)).data.user,null);
assert.equal((await call('/api/auth/recover',{username,password:'another-safe-password',recoveryCode:a.data.recoveryCode})).status,401);
assert.equal((await call('/api/auth/login',{username,password})).status,401);
assert.equal((await call(route,undefined,recovered)).data.view.version,1);
// Registration gives a recovery code; first-recovery should return 409 (already exists).
const frAlreadyHas=await call('/api/auth/first-recovery',{password:'replacement-safe-password'},{cookie:recovered.cookie,csrf:recovered.csrf});
assert.equal(frAlreadyHas.status,409,JSON.stringify(frAlreadyHas.data));
// Session must now report hasRecoveryCode true.
const sessionAfter=await call('/api/auth/session',undefined,recovered);
assert.equal(sessionAfter.data.hasRecoveryCode,true);
console.log('Court integration passed: ownership, CSRF, replay, stages, restore, fallback, recovery rotation, session revocation, and first-recovery guard.');
