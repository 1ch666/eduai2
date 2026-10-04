// Isolated restore drill only. No production export/import API or filesystem data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
const built=await build({entryPoints:['src/accounts.ts','src/backup-envelope.ts','src/account-backup.ts'],outdir:'unused',
 bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'mock-do',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}'}));
 }}]});
const modules=await Promise.all(built.outputFiles.map(f=>import('data:text/javascript;base64,'+Buffer.from(f.text).toString('base64'))));
const {AccountStore}=modules.find(m=>m.AccountStore),{sealBackup,openBackup}=modules.find(m=>m.sealBackup);
const {parseAccountBackup,MAX_ACCOUNT_BACKUP_BYTES}=modules.find(m=>m.parseAccountBackup);
const schema=new Ajv({strict:true}).compile(JSON.parse(await readFile('contracts/account-backup-v1.schema.json','utf8')));
const encode=x=>new TextEncoder().encode(JSON.stringify(x));
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
  assert.equal(schema(exported),true,JSON.stringify(schema.errors));
  const decoded=parseAccountBackup(await openBackup(encrypted,key,manifest));
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

test('account archive validator rejects corrupt structure, credentials, references and sessions',()=>{
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const date='2026-10-04T00:00:00.000Z';
 const fixture={schemaVersion:1,sessionPolicy:'reauthenticate',tables:{
  users:[{id,username:'synthetic',display_name:'測試',password_hash:'a'.repeat(64),password_salt:'b'.repeat(32),password_iterations:20000,created_at:date,last_login_at:null}],
  recovery_codes:[{user_id:id,code_hash:'c'.repeat(64)}],
  progress:[{user_id:id,scope:'civics',payload:'{"synthetic":true}',self_reported:1,updated_at:date}],
  auth_limits:[{key:'synthetic-limit',window_start:0,attempt_count:1}]
 }};
 assert(schema(fixture));assert.deepEqual(parseAccountBackup(encode(fixture)),fixture);
 const mutations=[
  x=>x.schemaVersion=2,x=>x.sessionPolicy='keep',x=>x.tables.sessions=[],x=>delete x.tables.progress,
  x=>x.tables.users.push({...x.tables.users[0]}),x=>x.tables.users.push({...x.tables.users[0],id:other}),
  x=>x.tables.users[0].password_hash='plaintext',x=>x.tables.users[0].password_salt='abc',
  x=>x.tables.users[0].password_iterations=400001,x=>x.tables.users[0].password_iterations=1,
  x=>x.tables.users[0].created_at='2026-02-30T00:00:00.000Z',
  x=>x.tables.users[0].last_login_at='2025-01-01T00:00:00.000Z',
  x=>x.tables.users[0].display_name='bad\u0000name',x=>x.tables.users[0].raw_password='PRIVATE',
  x=>x.tables.recovery_codes[0].user_id=other,x=>x.tables.recovery_codes.push({...x.tables.recovery_codes[0]}),
  x=>x.tables.progress[0].user_id=other,x=>x.tables.progress.push({...x.tables.progress[0]}),
  x=>x.tables.progress[0].scope='ranked',x=>x.tables.progress[0].self_reported=0,
  x=>x.tables.progress[0].payload='{',x=>x.tables.progress[0].payload=JSON.stringify('字'.repeat(3000)),
  x=>x.tables.auth_limits[0].window_start=1,x=>x.tables.auth_limits[0].attempt_count=0,
  x=>x.tables.auth_limits.push({...x.tables.auth_limits[0]})
 ];
 for(const mutate of mutations){const changed=structuredClone(fixture);mutate(changed);
  assert.throws(()=>parseAccountBackup(encode(changed)),/^Error: Invalid account backup$/);
 }
 for(const raw of [new Uint8Array(),new Uint8Array([255]),new Uint8Array(MAX_ACCOUNT_BACKUP_BYTES+1),encode(null),encode([]),
  new TextEncoder().encode(JSON.stringify(fixture).replace('{','{"schemaVersion":1,')),
  new TextEncoder().encode(' '+JSON.stringify(fixture))])
  assert.throws(()=>parseAccountBackup(raw),/^Error: Invalid account backup$/);
 const legacy=structuredClone(fixture);legacy.tables.recovery_codes=[];
 assert.deepEqual(parseAccountBackup(encode(legacy)),legacy,'legacy missing recovery code is preserved');
});
