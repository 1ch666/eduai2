/** Server-only admission contract v1. Pure reducer: the host MUST atomically
 * persist `state` before executing the single `start` effect. Never expose this
 * ledger (pseudonymous user/session keys) as a public capability response.
 * Time is supplied by the server, not Date.now() or a client field.
 */
export interface AdmissionPolicy {
  concurrency:number; queue:number; daily:number; userDaily:number;
  sessionDaily:number; queueMs:number; leaseMs:number; failureThreshold:number;
  cooldownMs:number; quotaCooldownMs:number; maxRecords:number;
}
export interface AdmissionRequest {
  id:string; fingerprint:string; userKey:string; sessionKey:string;
}
export type AdmissionPhase='queued'|'running'|'succeeded'|'failed'|'cancelled'|'unknown';
export type AdmissionOutcome='success'|'failure'|'quota';
export interface AdmissionRecord extends AdmissionRequest {
  day:number; created:number; deadline:number; phase:AdmissionPhase; circuitVersion:number;
  outcome:AdmissionOutcome|null;
  usage:{inputTokens:number|null;outputTokens:number|null}|null;
}
export interface AdmissionState {
  schemaVersion:1; clock:number; failures:number; openUntil:number; circuitVersion:number;
  records:AdmissionRecord[];
}
export type AdmissionCommand=
  | {type:'admit';request:AdmissionRequest}
  | {type:'poll';id:string}
  | {type:'cancel';id:string}
  | {type:'finish';id:string;outcome:AdmissionOutcome;usage:{inputTokens:number|null;outputTokens:number|null}}
  | {type:'tick'};
export type AdmissionCode='ACCEPTED'|'QUEUED'|'EXISTING'|'CONFLICT'|'NOT_FOUND'|
  'DISABLED'|'CIRCUIT_OPEN'|'QUEUE_FULL'|'BUDGET'|'CAPACITY'|'SETTLED'|'STALE'|'OK';
export interface AdmissionResult {
  state:AdmissionState; code:AdmissionCode; phase?:AdmissionPhase;
  /** Exactly one new grant; an EXISTING running record never re-emits it. */
  start?:AdmissionRequest;
}
const DAY=86400000;
const key=(s:string)=>typeof s==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(s);
const integer=(n:number,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export const emptyAdmission=():AdmissionState=>({schemaVersion:1,clock:0,failures:0,openUntil:0,circuitVersion:0,records:[]});
function validPolicy(p:AdmissionPolicy){
  return integer(p.concurrency,1,100)&&integer(p.queue,0,1000)&&integer(p.daily,1,100000)&&
    integer(p.userDaily,1,p.daily)&&integer(p.sessionDaily,1,p.userDaily)&&
    integer(p.queueMs,1,60000)&&integer(p.leaseMs,1,60000)&&
    integer(p.failureThreshold,1,100)&&integer(p.cooldownMs,1,DAY)&&
    integer(p.quotaCooldownMs,1,DAY)&&integer(p.maxRecords,1,100000);
}
function validRequest(r:AdmissionRequest){return !!r&&key(r.id)&&key(r.fingerprint)&&key(r.userKey)&&key(r.sessionKey);}
function validUsage(u:{inputTokens:number|null;outputTokens:number|null}){
  return !!u&&[u.inputTokens,u.outputTokens].every(n=>n===null||integer(n));
}
function validCommand(c:AdmissionCommand){
  if(!c||typeof c!=='object')return false;
  if(c.type==='tick')return true;
  if(c.type==='admit')return validRequest(c.request);
  if(!('id' in c)||!key(c.id))return false;
  if(c.type==='poll'||c.type==='cancel')return true;
  return c.type==='finish'&&['success','failure','quota'].includes(c.outcome)&&validUsage(c.usage);
}
const active=(r:AdmissionRecord)=>r.phase==='running'||r.phase==='queued';
const charged=(r:AdmissionRecord)=>r.phase!=='cancelled';

/** Typed internal boundary, not an untrusted JSON parser. The persistence host
 * must schema-validate restored state; invalid policy/command/clock fail closed.
 * No async I/O, random IDs, provider payloads, automatic retries or paid upgrade.
 */
export function reduceAdmission(previous:AdmissionState,command:AdmissionCommand,now:number,
  policy:AdmissionPolicy,enabled:boolean):AdmissionResult {
  if(!validPolicy(policy)||!validCommand(command)||!integer(now,0,8e15)||
    now<previous.clock||previous.schemaVersion!==1||typeof enabled!=='boolean')throw Error('Invalid admission input');
  const state=structuredClone(previous),day=Math.floor(now/DAY);state.clock=now;
  const fail=(quota=false,failedAt=now)=>{
    state.failures=quota?policy.failureThreshold:Math.min(policy.failureThreshold,state.failures+1);
    if(quota||state.failures>=policy.failureThreshold){
      state.openUntil=Math.max(state.openUntil,failedAt+(quota?policy.quotaCooldownMs:policy.cooldownMs));
      state.circuitVersion++;
    }
  };
  for(const row of state.records){
    // Expiry occurred at the lease deadline, not whenever a status reader next
    // happens to inspect it. Otherwise read-only probes perpetually project a
    // fresh cooldown after idle periods and clients can never attempt recovery.
    if(row.phase==='running'&&now>=row.deadline){row.phase='unknown';fail(false,row.deadline);}
    else if(row.phase==='queued'&&(!enabled||now>=row.deadline||row.day!==day))row.phase='cancelled';
  }
  const result=(code:AdmissionCode,row?:AdmissionRecord,start?:AdmissionRequest):AdmissionResult=>
    ({state,code,...(row?{phase:row.phase}:{}),...(start?{start}:{})});
  // Cancellation cannot prove that the provider stopped. Keep its slot until
  // the original lease ends, preventing cancellation from bypassing the cap.
  const running=()=>state.records.filter(r=>r.phase==='running'||r.phase==='unknown'&&now<r.deadline).length;
  // After cooldown only one probe may run until a success closes the circuit.
  const slots=()=>running()<(state.failures>=policy.failureThreshold?1:policy.concurrency);
  const grant=(row:AdmissionRecord)=>{
    row.phase='running';row.deadline=now+policy.leaseMs;
    row.circuitVersion=state.circuitVersion;
    return result('ACCEPTED',row,{id:row.id,fingerprint:row.fingerprint,userKey:row.userKey,sessionKey:row.sessionKey});
  };
  if(command.type==='tick')return result('OK');
  if(command.type==='admit'){
    const r=command.request,old=state.records.find(v=>v.id===r.id);
    if(old)return result(old.fingerprint===r.fingerprint&&old.userKey===r.userKey&&old.sessionKey===r.sessionKey?'EXISTING':'CONFLICT',old);
    if(!enabled)return result('DISABLED');
    if(now<state.openUntil)return result('CIRCUIT_OPEN');
    if(state.records.length>=policy.maxRecords)return result('CAPACITY');
    const today=state.records.filter(v=>v.day===day&&charged(v));
    if(today.length>=policy.daily||today.filter(v=>v.userKey===r.userKey).length>=policy.userDaily||
      today.filter(v=>v.userKey===r.userKey&&v.sessionKey===r.sessionKey).length>=policy.sessionDaily)return result('BUDGET');
    const queued=state.records.filter(v=>v.phase==='queued').length;
    const immediate=slots()&&queued===0;
    if(!immediate&&queued>=policy.queue)return result('QUEUE_FULL');
    // Project allowed fields; no caller object or unknown data enters storage.
    const row:AdmissionRecord={id:r.id,fingerprint:r.fingerprint,userKey:r.userKey,sessionKey:r.sessionKey,
      day,created:now,deadline:now+policy.queueMs,phase:'queued',circuitVersion:state.circuitVersion,outcome:null,usage:null};
    state.records.push(row);
    return immediate?grant(row):result('QUEUED',row);
  }
  const row=state.records.find(r=>r.id===command.id);
  if(!row)return result('NOT_FOUND');
  if(command.type==='poll'){
    if(row.phase!=='queued')return result('EXISTING',row);
    if(now<state.openUntil)return result('CIRCUIT_OPEN',row);
    return slots()&&state.records.find(r=>r.phase==='queued')===row?grant(row):result('QUEUED',row);
  }
  if(command.type==='cancel'){
    if(row.phase==='running')row.phase='unknown'; // May have reached provider: no refund.
    else if(row.phase==='queued')row.phase='cancelled';
    return result('SETTLED',row);
  }
  if(row.phase!=='running')return result('STALE',row);
  row.phase=command.outcome==='success'?'succeeded':'failed';row.outcome=command.outcome;
  row.usage={inputTokens:command.usage.inputTokens,outputTokens:command.usage.outputTokens};
  if(command.outcome==='success'){
    // An older parallel success cannot erase a newly opened quota/failure circuit.
    if(now>=state.openUntil&&row.circuitVersion===state.circuitVersion){state.failures=0;state.openUntil=0;}
  }else fail(command.outcome==='quota');
  return result('SETTLED',row);
}

/** Explicit bounded retention. Never remove an active reservation. The host must
 * reject command IDs older than its retention window before invoking admission,
 * otherwise a pruned ID could be submitted as a fresh request. Not auto-called.
 */
export function pruneAdmission(state:AdmissionState,beforeDay:number):AdmissionState {
  if(!integer(beforeDay)||beforeDay>=Math.floor(state.clock/DAY))throw Error('Invalid retention cutoff');
  return {...structuredClone(state),records:state.records.filter(r=>active(r)||r.day>=beforeDay).map(r=>structuredClone(r))};
}
