// Synthetic accounts in Node SQLite with mocked DO lifecycle; no production I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/accounts.ts'],bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'do-lifecycle',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}'}));}}]});
const {AccountStore}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function setup(){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...bindings){
  if(!bindings.length&&query.includes('CREATE TABLE')){db.exec(query);return {};}
  const statement=db.prepare(query);const rows=statement.columns().length?statement.all(...bindings):(statement.run(...bindings),[]);
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 const storage={sql,transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const store=new AccountStore({storage,blockConcurrencyWhile:fn=>fn()},{PASSWORD_ITERATIONS:'20000'});
 return {db,store};
}
const credentials={username:'race_user',password:'synthetic-old-password',displayName:'Synthetic',networkKey:'local'};
function holdCrypto(method,count=1){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto'),original=globalThis.crypto;
 const reached=gate(),release=gate();let held=0;
 const subtle=new Proxy(original.subtle,{get(target,key){const fn=Reflect.get(target,key,target);
  if(typeof fn!=='function')return fn;
  return async(...args)=>{const result=await fn.apply(target,args);
   if(key===method&&held<count){held++;if(held===count)reached.resolve();await release.promise;}return result;};
 }});
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle,
  randomUUID:original.randomUUID.bind(original),getRandomValues:original.getRandomValues.bind(original)}});
 return {reached:reached.promise,release:release.resolve,restore(){release.resolve();Object.defineProperty(globalThis,'crypto',descriptor);}};
}
async function digest(token){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');}

test('concurrent first recovery requests return one code and one conflict, never a SQL exception',async()=>{
 const {db,store}=setup();let held;
 try{
  const registered=await store.register(credentials);assert(registered.ok);
  db.prepare('DELETE FROM recovery_codes WHERE user_id=?').run(registered.user.id); // synthetic legacy account
  held=holdCrypto('digest',2);
  const input={userId:registered.user.id,password:credentials.password,networkKey:'local'};
  const first=store.firstRecovery(input),second=store.firstRecovery(input);
  const settled=Promise.allSettled([first,second]);await held.reached;held.release();
  const results=await settled;assert(results.every(r=>r.status==='fulfilled'),'concurrent request threw');
  assert.equal(results.filter(r=>r.value.ok).length,1);
  assert.equal(results.filter(r=>r.value.error==='ALREADY_EXISTS').length,1);
  const code=results.find(r=>r.value.ok).value.recoveryCode;
  assert.equal(db.prepare('SELECT code_hash FROM recovery_codes').get().code_hash,await digest(code));
 }finally{held?.restore();db.close();}
});

for(const boundary of ['deriveBits','digest'])test(`recovery fences old login paused at ${boundary}`,async()=>{
 const {db,store}=setup();let held;
 try{
  const registered=await store.register(credentials);assert(registered.ok);
  held=holdCrypto(boundary);
  const login=store.login(credentials);await held.reached;
  const recovered=await store.recover({username:credentials.username,password:'synthetic-new-password',recoveryCode:registered.recoveryCode,networkKey:'local'});
  assert(recovered.ok);held.release();assert.deepEqual(await login,{ok:false,error:'BAD_CREDENTIALS'});
  assert.equal(await store.session(await digest(registered.token)),null);
  assert.equal((await store.session(await digest(recovered.token))).user.id,registered.user.id);
  assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
 }finally{held?.restore();db.close();}
});

test('first recovery rechecks credentials after hashing the newly generated code',async()=>{
 const {db,store}=setup();let held;
 try{
  const registered=await store.register(credentials);assert(registered.ok);
  db.prepare('DELETE FROM recovery_codes WHERE user_id=?').run(registered.user.id);
  held=holdCrypto('digest');
  const pending=store.firstRecovery({userId:registered.user.id,password:credentials.password,networkKey:'local'});
  await held.reached;
  db.prepare('UPDATE users SET password_salt=? WHERE id=?').run('00'.repeat(16),registered.user.id);
  held.release();assert.deepEqual(await pending,{ok:false,error:'BAD_CREDENTIALS'});
  assert.equal(db.prepare('SELECT count(*) AS n FROM recovery_codes').get().n,0);
 }finally{held?.restore();db.close();}
});

test('concurrent reuse of one recovery code resets once and preserves learning records',async()=>{
 const {db,store}=setup();let held;
 try{
  const registered=await store.register(credentials);assert(registered.ok);
  await store.saveProgress(registered.user.id,'civics',JSON.stringify({synthetic:true}));
  const before=await store.progress(registered.user.id);
  held=holdCrypto('deriveBits',2);
  const input={username:credentials.username,password:'synthetic-new-password',recoveryCode:registered.recoveryCode,networkKey:'local'};
  const pending=Promise.all([store.recover(input),store.recover(input)]);
  await held.reached;held.release();const results=await pending;
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal(results.filter(r=>r.error==='BAD_CREDENTIALS').length,1);
  assert.deepEqual(await store.progress(registered.user.id),before);
  assert.equal(await store.session(await digest(registered.token)),null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
  const winner=results.find(r=>r.ok);
  assert.equal(db.prepare('SELECT code_hash FROM recovery_codes').get().code_hash,await digest(winner.recoveryCode));
 }finally{held?.restore();db.close();}
});
