import {canonical} from '../court/protocol.js';

export interface BackupMetadata {
 schemaVersion:1;archiveId:string;kind:'court'|'accounts'|'progress'|'experiments';
 createdAt:string;sourceCommit:string;keyId:string;
}
export const MAX_BACKUP_PLAINTEXT_BYTES=4*1024*1024;
const MAX_CIPHERTEXT_CHARS=4*Math.ceil((MAX_BACKUP_PLAINTEXT_BYTES+16)/3);
const fail=()=>new Error('Invalid backup archive');
const encoder=new TextEncoder();
function exact(value:unknown,keys:string[]):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 return Reflect.ownKeys(value).length===keys.length&&keys.every(k=>{
  const d=Object.getOwnPropertyDescriptor(value,k);return !!d&&'value' in d&&d.enumerable;
 });
}
function metadata(value:unknown):BackupMetadata{
 if(!exact(value,['schemaVersion','archiveId','kind','createdAt','sourceCommit','keyId'])||value.schemaVersion!==1||
  typeof value.archiveId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.archiveId)||
  typeof value.kind!=='string'||!['court','accounts','progress','experiments'].includes(value.kind)||
  typeof value.createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.createdAt)||!Number.isFinite(Date.parse(value.createdAt))||new Date(value.createdAt).toISOString()!==value.createdAt||
  typeof value.sourceCommit!=='string'||!/^[0-9a-f]{40}$/.test(value.sourceCommit)||
  typeof value.keyId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(value.keyId))throw fail();
 return {schemaVersion:1,archiveId:value.archiveId,kind:value.kind as BackupMetadata['kind'],createdAt:value.createdAt,sourceCommit:value.sourceCommit,keyId:value.keyId};
}
function requireKey(key:CryptoKey,usage:'encrypt'|'decrypt'){
 if(!key||key.type!=='secret'||key.extractable||key.algorithm.name!=='AES-GCM'||
  !('length' in key.algorithm)||key.algorithm.length!==256||!key.usages.includes(usage))throw fail();
}
const aad=(meta:BackupMetadata)=>encoder.encode('eduai-backup-v1\0'+canonical(meta));
function base64(bytes:Uint8Array):string{
 let encoded='';for(let offset=0;offset<bytes.length;offset+=8192)encoded+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
 return btoa(encoded);
}
function decode(value:unknown,max:number):Uint8Array<ArrayBuffer>{
 if(typeof value!=='string'||!value.length||value.length>max||value.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw fail();
 const decoded=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 if(base64(decoded)!==value)throw fail();return decoded;
}

/** Operator-side building block. Keys are caller-supplied nonextractable Web
 * Crypto keys, never read from front-end state, source, logs or archive files.
 * No persistence/network/restore side effects. Each seal uses a fresh 96-bit IV.
 */
export async function sealBackup(plaintext:Uint8Array,key:CryptoKey,info:BackupMetadata):Promise<string>{
 try{
  requireKey(key,'encrypt');const meta=metadata(info);
  if(!(plaintext instanceof Uint8Array)||plaintext.byteLength<1||plaintext.byteLength>MAX_BACKUP_PLAINTEXT_BYTES)throw fail();
  const copy=new Uint8Array(plaintext),iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(meta),tagLength:128},key,copy);
  return canonical({algorithm:'AES-256-GCM',metadata:meta,iv:base64(iv),ciphertext:base64(new Uint8Array(encrypted))});
 }catch{throw fail();}
}

/** expected comes from the operator's trusted manifest, NOT parsed archive
 * metadata. Exact binding prevents silently swapping another authentic backup.
 * Returned bytes remain untrusted DOMAIN data: validate before an isolated restore.
 */
export async function openBackup(raw:string,key:CryptoKey,expected:BackupMetadata):Promise<Uint8Array>{
 try{
  requireKey(key,'decrypt');const wanted=metadata(expected);
  if(typeof raw!=='string'||raw.length>MAX_CIPHERTEXT_CHARS+1024)throw fail();
  const envelope:unknown=JSON.parse(raw);
  if(!exact(envelope,['algorithm','metadata','iv','ciphertext'])||envelope.algorithm!=='AES-256-GCM')throw fail();
  const meta=metadata(envelope.metadata);
  // Canonical-only framing rejects duplicate JSON keys, extra whitespace and
  // alternate encodings; the encrypted payload itself may be arbitrary bytes.
  if(canonical(envelope)!==raw||canonical(meta)!==canonical(wanted))throw fail();
  const iv=decode(envelope.iv,16),ciphertext=decode(envelope.ciphertext,MAX_CIPHERTEXT_CHARS);
  if(iv.length!==12||ciphertext.length<17||ciphertext.length>MAX_BACKUP_PLAINTEXT_BYTES+16)throw fail();
  const result=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(meta),tagLength:128},key,ciphertext);
  return new Uint8Array(result);
 }catch{throw fail();}
}
