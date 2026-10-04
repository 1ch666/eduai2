// Isolated restore drill only. No production export/import API or filesystem data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const built=await build({entryPoints:['src/accounts.ts','src/backup-envelope.ts'],outdir:'unused',
 bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'mock-do',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}'}));
 }}]});
const modules=await Promise.all(built.outputFiles.map(f=>import('data:text/javascript;base64,'+Buffer.from(f.text).toString('base64'))));
const {AccountStore}=modules.find(m=>m.AccountStore),{sealBackup,openBackup}=modules.find(m=>m.sealBackup);
const tables=['auth_limits','progress','recovery_codes','sessions','users'];
const restoredTables=['users','recovery_codes','progress','auth_limits'];
function setup(){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...values){
  if(!values.length&&query.includes('CREATE TABLE')){db.exec(query);return {};}
  const s=db.prepare(query),rows=s.columns().length?s.all(...values):(s.run(...values),[]);
  return {toArray:()=>rows};
 }};
 const transactionSync=fn=>{db.exec('BEGIN');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
 const store=new AccountStore({storage:{sql,transactionSync},blockConcurrencyWhile:fn=>fn()},{PASSWORD_ITERATIONS:'20000'});
 return {db,store,transactionSync};
}
const rows=(db,table)=>db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
const snapshot=db=>Object.fromEntries(tables.map(table=>[table,rows(db,table)]));
const digest=async token=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');

// Test-local importer: only trusted fixture output, NOT validation of arbitrary
// archives. Table/column identifiers come from the current destination schema.
function restoreFixture(target,data,failAfter){
 for(const table of tables)assert.equal(rows(target.db,table).length,0,'destination must be empty');
 target.transactionSync(()=>{
  for(const table of restoredTables){
   const columns=target.db.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name);
   const insert=target.db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
   for(const row of data[table])insert.run(...columns.map(c=>row[c]));
   if(table===failAfter)throw Error('synthetic restore interruption');
  }
 });
}

test('encrypted account restore preserves identity, credentials and progress without reviving sessions',async()=>{
 const source=setup(),target=setup();
 try{
  assert.deepEqual(source.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>r.name),tables,
   'update restore inventory when the account schema adds a table');
  const credentials={username:'restore_one',displayName:'合成帳號甲',password:'synthetic-password-one',networkKey:'synthetic-a'};
  const alice=await source.store.register(credentials);
  const bob=await source.store.register({username:'restore_two',displayName:'合成帳號乙',password:'synthetic-password-two',networkKey:'synthetic-b'});
  assert(alice.ok&&bob.ok);
  for(const scope of ['civics','daily','court','game']){
   await source.store.saveProgress(alice.user.id,scope,JSON.stringify({note:'合成進度',scope}));
   await source.store.saveProgress(bob.user.id,scope,JSON.stringify({note:'另一帳號',scope}));
  }
  const before=snapshot(source.db),aliceProgress=await source.store.progress(alice.user.id),bobProgress=await source.store.progress(bob.user.id);
  // Session material is excluded before encryption, not merely discarded later.
  const exported={schemaVersion:1,sessionPolicy:'reauthenticate',tables:Object.fromEntries(restoredTables.map(t=>[t,before[t]]))};
  const plaintext=JSON.stringify(exported);
  for(const secret of [credentials.password,alice.token,alice.csrfToken,alice.recoveryCode,bob.token,bob.recoveryCode])assert(!plaintext.includes(secret));
  assert(!plaintext.includes(await digest(alice.token)));
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const manifest={schemaVersion:1,archiveId:crypto.randomUUID(),kind:'accounts',createdAt:new Date().toISOString(),sourceCommit:'a'.repeat(40),keyId:'synthetic-ephemeral'};
  const encrypted=await sealBackup(new TextEncoder().encode(plaintext),key,manifest);
  assert(!encrypted.includes(alice.user.username));
  const decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await openBackup(encrypted,key,manifest)));
  assert.equal(decoded.sessionPolicy,'reauthenticate');
  assert.throws(()=>restoreFixture(target,decoded.tables,'progress'),/synthetic restore interruption/);
  assert(tables.every(t=>rows(target.db,t).length===0),'partial import must roll back');
  restoreFixture(target,decoded.tables);
  for(const table of restoredTables)assert.deepEqual(rows(target.db,table),before[table]);
  assert.equal(rows(target.db,'sessions').length,0);
  assert.equal(await target.store.session(await digest(alice.token)),null);
  assert.equal(await target.store.session(await digest(bob.token)),null);
  assert.deepEqual(await target.store.progress(alice.user.id),aliceProgress);
  assert.deepEqual(await target.store.progress(bob.user.id),bobProgress);
  assert.deepEqual(await target.store.progress('unrelated-synthetic-id'),[]);
  const logged=await target.store.login(credentials);assert(logged.ok);assert.deepEqual(logged.user,alice.user);
  assert.notEqual(logged.token,alice.token);
  assert.equal((await target.store.session(await digest(logged.token))).user.id,alice.user.id);
  const recovered=await target.store.recover({username:credentials.username,password:'synthetic-replacement-password',
   recoveryCode:alice.recoveryCode,networkKey:'restore-recovery'});
  assert(recovered.ok);assert.deepEqual(recovered.user,alice.user);
  assert.equal(await target.store.session(await digest(logged.token)),null);
  assert.deepEqual(await target.store.login(credentials),{ok:false,error:'BAD_CREDENTIALS'});
  assert.deepEqual(await target.store.progress(alice.user.id),aliceProgress);
  assert.deepEqual(await target.store.progress(bob.user.id),bobProgress);
  const reused=await target.store.recover({username:credentials.username,password:'another-synthetic-password',
   recoveryCode:alice.recoveryCode,networkKey:'restore-recovery'});
  assert.deepEqual(reused,{ok:false,error:'BAD_CREDENTIALS'});
  const targetBefore=snapshot(target.db);
  assert.throws(()=>restoreFixture(target,decoded.tables),/destination must be empty/);
  assert.deepEqual(snapshot(target.db),targetBefore,'never overwrite a populated destination');
  assert.deepEqual(snapshot(source.db),before,'restore must not modify source');
 }finally{source.db.close();target.db.close();}
});
