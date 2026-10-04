// Offline, read-only: never connects to Cloudflare or opens a database.
import {open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openBackup} from '../src/backup-envelope.ts';
import {parseAccountBackup,MAX_ACCOUNT_BACKUP_BYTES} from '../src/account-backup.ts';

async function boundedRead(path,max){
 const handle=await open(path,'r');
 try{
  const stat=await handle.stat();
  if(!stat.isFile()||stat.size<1||stat.size>max)throw Error('invalid input');
  const buffer=Buffer.alloc(max+1);let count=0;
  while(count<buffer.length){const {bytesRead}=await handle.read(buffer,count,buffer.length-count,null);if(!bytesRead)break;count+=bytesRead;}
  if(!count||count>max)throw Error('invalid input');
  return buffer.subarray(0,count);
 }finally{await handle.close();}
}

export async function verifyAccountBackupFiles(archivePath,manifestPath,keyPath){
 let rawKey,plaintext;
 try{
  const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  // Manifest must be supplied independently by the operator, never extracted
  // from the archive. This tool cannot establish the manifest's trust itself.
  const manifest=JSON.parse(decode(await boundedRead(manifestPath,4096)));
  if(manifest?.kind!=='accounts')throw Error('invalid domain');
  rawKey=await boundedRead(keyPath,32);
  if(rawKey.byteLength!==32)throw Error('invalid key');
  const key=await crypto.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['decrypt']);
  rawKey.fill(0);
  const archive=decode(await boundedRead(archivePath,4*Math.ceil((MAX_ACCOUNT_BACKUP_BYTES+16)/3)+1024));
  plaintext=await openBackup(archive,key,manifest);
  const parsed=parseAccountBackup(plaintext);
  return {ok:true,verification:'crypto-and-domain-only',schemaVersion:1,sessionPolicy:'reauthenticate',
   counts:Object.fromEntries(Object.entries(parsed.tables).map(([name,rows])=>[name,rows.length])),
   restored:false};
 }catch{throw Error('Account backup verification failed');}
 finally{
  rawKey?.fill(0);plaintext?.fill(0);
  // Best effort for byte buffers only; JS strings/CryptoKey memory is not erasable.
 }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==5)throw Error('usage');
  console.log(JSON.stringify(await verifyAccountBackupFiles(...process.argv.slice(2))));
 }catch{
  console.error('Account backup verification failed. Usage: node scripts/check-account-backup.mjs <archive> <trusted-manifest> <32-byte-key-file>');
  process.exitCode=1;
 }
}
