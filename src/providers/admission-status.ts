import {reduceAdmission,pruneAdmission,type AdmissionState,type AdmissionPolicy} from './admission';

export interface AdmissionStatus {
  schemaVersion:1;
  scope:'provider-account';
  checkedAt:number;
  code:'READY'|'DISABLED'|'CIRCUIT_OPEN'|'BUDGET'|'QUEUE_FULL'|'CAPACITY';
  canAttempt:boolean;
  providerHealth:'not-probed';
}

/** Read-only projection, not a reservation. The caller may still fail user,
 * session or endpoint limits. Never imply vendor quota/auth/network is healthy.
 * Apply the same expiry/prune rules virtually, without persisting or granting.
 */
export function admissionStatus(previous:AdmissionState,now:number,policy:AdmissionPolicy,enabled:boolean):AdmissionStatus {
  let state=reduceAdmission(previous,{type:'tick'},now,policy,enabled).state;
  const day=Math.floor(now/86400000);
  if(day>1)state=pruneAdmission(state,day-1);
  let code:AdmissionStatus['code']='READY';
  if(!enabled)code='DISABLED';
  else if(now<state.openUntil)code='CIRCUIT_OPEN';
  else if(state.records.length>=policy.maxRecords)code='CAPACITY';
  else if(state.records.filter(r=>r.day===day&&r.phase!=='cancelled').length>=policy.daily)code='BUDGET';
  else{
    const running=state.records.filter(r=>r.phase==='running'||r.phase==='unknown'&&now<r.deadline).length;
    const queued=state.records.filter(r=>r.phase==='queued').length;
    const slots=running<(state.failures>=policy.failureThreshold?1:policy.concurrency);
    if(!(slots&&queued===0)&&queued>=policy.queue)code='QUEUE_FULL';
  }
  return {schemaVersion:1,scope:'provider-account',checkedAt:now,code,canAttempt:code==='READY',providerHealth:'not-probed'};
}
