import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {sealBackup} from '../src/backup-envelope.ts';
import {verifyAccountBackupFiles} from './check-account-backup.mjs';

test('offline verifier decrypts synthetic archive, prints only counts and changes no input',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'eduai-backup-cli-'));
 try{
  const paths=['archive.json','manifest.json','key.bin'].map(p=>join(dir,p));
  const keyBytes=crypto.getRandomValues(new Uint8Array(32));
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['encrypt']);
  const meta={schemaVersion:1,archiveId:crypto.randomUUID(),kind:'accounts',createdAt:'2026-10-04T00:00:00.000Z',sourceCommit:'a'.repeat(40),keyId:'synthetic'};
  const payload={schemaVersion:1,sessionPolicy:'reauthenticate',tables:{users:[],recovery_codes:[],progress:[],auth_limits:[]}};
  const archive=await sealBackup(new TextEncoder().encode(JSON.stringify(payload)),key,meta);
  await Promise.all([writeFile(paths[0],archive),writeFile(paths[1],JSON.stringify(meta)),writeFile(paths[2],keyBytes,{mode:0o600})]);
  const before=await Promise.all(paths.map(p=>readFile(p)));
  const expected={ok:true,verification:'crypto-and-domain-only',schemaVersion:1,sessionPolicy:'reauthenticate',counts:{users:0,recovery_codes:0,progress:0,auth_limits:0},restored:false};
  assert.deepEqual(await verifyAccountBackupFiles(...paths),expected);
  const cli=spawnSync(process.execPath,['scripts/check-account-backup.mjs',...paths],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);assert.deepEqual(JSON.parse(cli.stdout),expected);assert.equal(cli.stderr,'');
  assert.deepEqual(await Promise.all(paths.map(p=>readFile(p))),before);
  await writeFile(paths[1],JSON.stringify({...meta,archiveId:crypto.randomUUID()}));
  await assert.rejects(verifyAccountBackupFiles(...paths),/^Error: Account backup verification failed$/);
  await writeFile(paths[1],JSON.stringify(meta));
  await writeFile(paths[2],new Uint8Array(32));
  const fail=spawnSync(process.execPath,['scripts/check-account-backup.mjs',...paths],{encoding:'utf8'});
  assert.equal(fail.status,1);assert.equal(fail.stdout,'');assert(!fail.stderr.includes(dir));assert(!fail.stderr.includes(meta.archiveId));
  for(const bytes of [new Uint8Array(31),new Uint8Array(33)]){
   await writeFile(paths[2],bytes);await assert.rejects(verifyAccountBackupFiles(...paths),/verification failed/);
  }
  await writeFile(paths[2],keyBytes);
  await writeFile(paths[0],await sealBackup(new TextEncoder().encode('{"private":"SENSITIVE_FIXTURE"}'),key,meta));
  await assert.rejects(verifyAccountBackupFiles(...paths),/^Error: Account backup verification failed$/);
  await assert.rejects(verifyAccountBackupFiles(dir,paths[1],paths[2]),/verification failed/);
  await writeFile(paths[0],new Uint8Array(6*1024*1024));
  await assert.rejects(verifyAccountBackupFiles(...paths),/verification failed/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
