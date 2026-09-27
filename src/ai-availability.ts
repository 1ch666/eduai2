import type {AppEnv} from './env';
import {ADMISSION_ACCOUNT} from './providers/governed-ollama';
import type {AdmissionStatus} from './providers/admission-status';

export interface AiAvailability {
  schemaVersion:1;
  scope:'provider-account';
  configured:boolean;
  canAttempt:boolean;
  reason:AdmissionStatus['code']|'NOT_CONFIGURED'|'UNAVAILABLE';
  providerHealth:'not-probed';
}

/** No inference health probe, identities or ledger counts. A true canAttempt
 * means account-level permission only; auth/user/endpoint guards still apply.
 * No mutable global cache: a kill switch must not be hidden by stale status.
 */
export async function aiAvailability(env:AppEnv):Promise<AiAvailability>{
  const configured=Boolean(env.OLLAMA_API_KEY);
  const result=(reason:AiAvailability['reason']):AiAvailability=>({schemaVersion:1,scope:'provider-account',
    configured,canAttempt:reason==='READY',reason,providerHealth:'not-probed'});
  if(!configured)return result('NOT_CONFIGURED');
  if(env.AI_ADMISSION_ENABLED!=='true')return result('DISABLED');
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const s=await Promise.race([
      env.AI_ADMISSION.getByName(ADMISSION_ACCOUNT).inspect(),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Status timeout')),1000);})
    ]);
    if(!s||s.schemaVersion!==1||s.scope!=='provider-account'||s.providerHealth!=='not-probed'||
      !Number.isSafeInteger(s.checkedAt)||s.checkedAt<0||s.checkedAt>8e15||
      !['READY','DISABLED','CIRCUIT_OPEN','BUDGET','QUEUE_FULL','CAPACITY'].includes(s.code)||
      s.canAttempt!==(s.code==='READY'))return result('UNAVAILABLE');
    return result(s.code);
  }catch{return result('UNAVAILABLE');}
  finally{if(timer!==undefined)clearTimeout(timer);}
}
