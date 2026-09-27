import {emptyAdmission,reduceAdmission,type AdmissionCommand,type AdmissionPolicy,type AdmissionRequest,type AdmissionResult} from './admission';
import {parseAdmissionState} from './admission-state';

export const ADMISSION_STORE_MAX_BYTES=1048576;
export interface AdmissionStorage {
  sql:{exec(query:string,...bindings:(string|number)[]):{toArray():Record<string,unknown>[]}};
  transactionSync<T>(fn:()=>T):T;
}
export type AdmissionReceipt=Omit<AdmissionResult,'state'|'start'> & {start:boolean;deadline?:number};
const invalid=()=>{throw Error('Admission storage unavailable');};
const encoded=(body:string)=>new TextEncoder().encode(body).byteLength;
const same=(a:AdmissionRequest,b:AdmissionRequest)=>a.id===b.id&&a.fingerprint===b.fingerprint&&a.userKey===b.userKey&&a.sessionKey===b.sessionKey;
function validRequest(r:AdmissionRequest){
  return !!r&&typeof r==='object'&&Object.keys(r).length===4&&
    ['id','fingerprint','userKey','sessionKey'].every(k=>{
      const d=Object.getOwnPropertyDescriptor(r,k);
      return d&&'value' in d&&typeof d.value==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(d.value);
    });
}

/** Durable synchronous transaction boundary; no provider call inside it.
 * Initialization metadata distinguishes a new store from a missing state row.
 */
export function initializeAdmissionStore(storage:AdmissionStorage):void {
  storage.transactionSync(()=>{
    storage.sql.exec('CREATE TABLE IF NOT EXISTS ai_admission_meta(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL)');
    storage.sql.exec('CREATE TABLE IF NOT EXISTS ai_admission_state(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL)');
    const meta=storage.sql.exec('SELECT version FROM ai_admission_meta WHERE id=1').toArray();
    const rows=storage.sql.exec('SELECT id FROM ai_admission_state WHERE id=1').toArray();
    if(!meta.length){
      if(rows.length)invalid();
      storage.sql.exec('INSERT INTO ai_admission_meta VALUES(1,1)');
      storage.sql.exec('INSERT INTO ai_admission_state VALUES(1,?)',JSON.stringify(emptyAdmission()));
    }else if(meta.length!==1||meta[0].version!==1||rows.length!==1)invalid();
  });
}

export function executeAdmission(storage:AdmissionStorage,identity:AdmissionRequest,command:AdmissionCommand,
  now:number,policy:AdmissionPolicy,enabled:boolean):AdmissionReceipt {
  if(!validRequest(identity)||command.type==='tick'||
    (command.type==='admit'?!validRequest(command.request)||!same(identity,command.request):command.id!==identity.id))
    throw Error('Invalid admission command');
  return storage.transactionSync(()=>{
    const meta=storage.sql.exec('SELECT version FROM ai_admission_meta WHERE id=1').toArray();
    if(meta.length!==1||meta[0].version!==1)invalid();
    const row=storage.sql.exec('SELECT body FROM ai_admission_state WHERE id=1').toArray()[0];
    if(!row||typeof row.body!=='string'||row.body.length>ADMISSION_STORE_MAX_BYTES||encoded(row.body)>ADMISSION_STORE_MAX_BYTES)invalid();
    let parsed:unknown;try{parsed=JSON.parse(row.body as string);}catch{invalid();}
    const state=parseAdmissionState(parsed);if(!state)return invalid();
    const old=state.records.find(r=>r.id===identity.id);
    // No phase/deadline disclosure for a mismatching owner, session or payload.
    if(old&&!same(old,identity))return {code:'CONFLICT',start:false};
    const result=reduceAdmission(state,command,now,policy,enabled);
    if(!parseAdmissionState(result.state))return invalid();
    const body=JSON.stringify(result.state);
    if(encoded(body)>ADMISSION_STORE_MAX_BYTES)return invalid();
    storage.sql.exec('UPDATE ai_admission_state SET body=? WHERE id=1',body);
    const current=result.state.records.find(r=>r.id===identity.id);
    return {code:result.code,...(result.phase?{phase:result.phase}:{}),start:!!result.start,
      ...(result.start&&current?{deadline:current.deadline}:{})};
  });
}
