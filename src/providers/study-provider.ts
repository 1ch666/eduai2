import type {AppEnv} from '../env';
import {sha256Hex} from '../http';
import type {ChatInput,LLMProvider} from './contracts';
import {createGovernedOllamaProvider} from './governed-ollama';
import type {StudyKind,StudyReservation} from './study-attempts';
import type {TraceContext} from '../trace-context';

export type StudyProviderResult={ok:true;provider:LLMProvider}|
  {ok:false;code:'AI_ATTEMPT_ALREADY_USED'|'AI_REQUEST_CONFLICT'|'AI_ATTEMPT_CAPACITY'|'ADMISSION_UNAVAILABLE';status:409|503};

/** Called only after HTTP validation/auth/rate guards. owner is server-derived,
 * not a body field. Reserve before provider admission, including across midnight.
 * A lost reservation reply is never retried; it cannot cause a second inference.
 */
export async function studyProvider(env:AppEnv,kind:StudyKind,owner:string,requestId:string,input:ChatInput,
  thinking?:false|'low',trace?:TraceContext):Promise<StudyProviderResult>{
  try{
    const [id,fingerprint]=await Promise.all([
      sha256Hex(JSON.stringify(['study-request-v1',requestId.toLowerCase()])),
      sha256Hex(JSON.stringify(['study-input-v1',input]))
    ]);
    // Lost or slow RPC receipts cannot grant after the caller has timed out.
    let timer:ReturnType<typeof setTimeout>|undefined;
    let receipt:StudyReservation;
    try{
      receipt=await Promise.race([
        env.LEARNER.getByName(owner).reserveStudyAi(kind,id,fingerprint),
        new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Reservation timeout')),1000);})
      ]);
    }finally{if(timer!==undefined)clearTimeout(timer);}
    if(receipt.code!=='RESERVED')return receipt.code==='EXISTING'?{ok:false,code:'AI_ATTEMPT_ALREADY_USED',status:409}:
      receipt.code==='CONFLICT'?{ok:false,code:'AI_REQUEST_CONFLICT',status:409}:
      {ok:false,code:receipt.code==='CAPACITY'?'AI_ATTEMPT_CAPACITY':'ADMISSION_UNAVAILABLE',status:503};
    return {ok:true,provider:await createGovernedOllamaProvider(env,{
      kind,owner,sessionId:'study',requestKey:id,issuedAt:receipt.issuedAt
    },thinking,trace)};
  }catch{
    return {ok:false,code:'ADMISSION_UNAVAILABLE',status:503};
  }
}

export const STUDY_RESERVATION_MESSAGES={
  AI_ATTEMPT_ALREADY_USED:'此請求已受理，可能處理中、完成或中斷；為避免重複消耗額度，不會再次呼叫模型。',
  AI_REQUEST_CONFLICT:'此請求識別已用於不同內容。',
  AI_ATTEMPT_CAPACITY:'安全請求紀錄已達容量上限，AI 暫停；請聯絡管理者，請勿清除紀錄繞過限制。',
  ADMISSION_UNAVAILABLE:'AI 流量控管暫時無法確認，本次不會呼叫模型。'
} as const;
