import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import Ajv from 'ajv';
import {canonical} from '../court/protocol.js';
import {newCourtAt,CASES} from '../src/court-rules.ts';
const bundle=await build({entryPoints:['src/backup-envelope.ts','src/court-private-state.ts'],bundle:true,platform:'node',format:'esm',outdir:'unused',write:false});
const modules=await Promise.all(bundle.outputFiles.map(f=>import('data:text/javascript;base64,'+Buffer.from(f.text).toString('base64'))));
const {sealBackup:seal,openBackup:open,MAX_BACKUP_PLAINTEXT_BYTES:MAX}=modules.find(m=>m.sealBackup);
const {parsePrivateCourtState}=modules.find(m=>m.parsePrivateCourtState);
const schema=new Ajv({strict:true}).compile(JSON.parse(await readFile('contracts/backup-envelope-v1.schema.json','utf8')));
const makeKey=()=>crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
const info=()=>({schemaVersion:1,archiveId:crypto.randomUUID(),kind:'court',createdAt:'2026-09-28T00:00:00.000Z',sourceCommit:'a'.repeat(40),keyId:'synthetic-key-1'});
const encode=s=>new TextEncoder().encode(s),decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
test('encrypted backup round trip preserves bytes, randomizes IV and hides private payload',async()=>{
 const key=await makeKey(),meta=info(),bytes=encode('PRIVATE_SYNTHETIC_日本語_繁體中文');
 const one=await seal(bytes,key,meta),two=await seal(bytes,key,meta);
 assert.equal(schema(JSON.parse(one)),true);assert.notEqual(one,two);assert.notEqual(JSON.parse(one).iv,JSON.parse(two).iv);
 assert.ok(!one.includes('PRIVATE_SYNTHETIC'));assert.deepEqual(await open(one,key,meta),bytes);
 assert.deepEqual(await open(two,key,meta),bytes);
});
test('tampering, wrong key and substitution of another valid archive are rejected',async()=>{
 const key=await makeKey(),meta=info(),raw=await seal(encode('private'),key,meta),original=JSON.parse(raw);
 await assert.rejects(open(raw,await makeKey(),meta),/^Error: Invalid backup archive$/);
 const mutations=[x=>x.algorithm='AES-CBC',x=>x.iv=(x.iv[0]==='A'?'B':'A')+x.iv.slice(1),
 x=>x.ciphertext=(x.ciphertext[0]==='A'?'B':'A')+x.ciphertext.slice(1),x=>x.ciphertext=x.ciphertext.slice(4),
 x=>x.metadata.sourceCommit='b'.repeat(40),x=>x.metadata.createdAt='2026-09-29T00:00:00.000Z',x=>x.metadata.keyId='other',
 x=>x.metadata.kind='accounts',x=>x.metadata.schemaVersion=2,x=>x.extra='PRIVATE'];
 for(const mutate of mutations){const changed=structuredClone(original);mutate(changed);
  await assert.rejects(open(canonical(changed),key,meta),/Invalid backup archive/);
 }
 // Even trusting the tampered metadata cannot bypass authenticated AAD.
 const changed=structuredClone(original);changed.metadata.keyId='other';
 await assert.rejects(open(canonical(changed),key,changed.metadata),/Invalid backup archive/);
 const other=info(),validOther=await seal(encode('other court'),key,other);
 await assert.rejects(open(validOther,key,meta),/Invalid backup archive/);
});
test('framing and key policy reject duplicates, malformed encodings, accessors and excess size',async()=>{
 const key=await makeKey(),meta=info(),raw=await seal(encode('test'),key,meta);
 for(const bad of [' '+raw,raw+' ',raw.replace('{','{"algorithm":"AES-256-GCM",'),'{',raw.slice(0,-1),canonical({...JSON.parse(raw),iv:'!!!!'}), 'x'.repeat(5592428+1025)])
  await assert.rejects(open(bad,key,meta),/Invalid backup archive/);
 for(const bytes of [new Uint8Array(),new Uint8Array(MAX+1)])await assert.rejects(seal(bytes,key,meta),/Invalid backup archive/);
 const extractable=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
 await assert.rejects(seal(encode('x'),extractable,meta),/Invalid backup archive/);
 let calls=0;const accessor={...meta};Object.defineProperty(accessor,'keyId',{enumerable:true,get(){calls++;throw Error('SECRET');}});
 await assert.rejects(seal(encode('x'),key,accessor),/Invalid backup archive/);assert.equal(calls,0);
 const pending=seal(encode('before'),key,meta),saved={...meta};meta.keyId='mutated';
 assert.equal(decode(await open(await pending,key,saved)),'before');
});
test('maximum bounded payload round trips without truncation',async()=>{
 const bytes=new Uint8Array(MAX);bytes[0]=123;bytes[MAX-1]=245;
 const key=await makeKey(),meta=info(),raw=await seal(bytes,key,meta);
 assert.equal(schema(JSON.parse(raw)),true);assert.deepEqual(await open(raw,key,meta),bytes);
});
test('decrypted synthetic court snapshot still passes identity and domain validation before use',async()=>{
 const expected={sessionId:crypto.randomUUID(),owner:'synthetic-owner'},key=await makeKey(),meta=info();
 const state=newCourtAt(expected.sessionId,expected.owner,{caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,
  respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'},meta.createdAt);
 state.generatedCase=structuredClone(CASES[0]);
 const raw=await seal(encode(canonical(state)),key,meta),opened=JSON.parse(decode(await open(raw,key,meta)));
 assert.deepEqual(parsePrivateCourtState(opened,expected),state);
 assert.equal(parsePrivateCourtState(opened,{...expected,owner:'other'}),null);
 const forged={...state,stage:5,completed:true};
 const authenticButInvalid=await seal(encode(canonical(forged)),key,meta);
 assert.equal(parsePrivateCourtState(JSON.parse(decode(await open(authenticButInvalid,key,meta))),expected),null);
 // Crypto authenticity is not permission to restore or evidence of legal history.
});
