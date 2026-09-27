import type {AdmissionRequest, AdmissionOutcome} from './admission';
import type {AdmissionReceipt} from './admission-store';
import type {ChatInput, LLMProvider, ProviderContext, ProviderResult, TokenUsage} from './contracts';

/** Private RPC port, never exposed to browsers. No prompt or secret crosses it. */
export interface AdmissionPort {
  admit(request:AdmissionRequest):Promise<AdmissionReceipt>;
  poll(request:AdmissionRequest):Promise<AdmissionReceipt>;
  cancel(request:AdmissionRequest):Promise<AdmissionReceipt>;
  finish(request:AdmissionRequest,outcome:AdmissionOutcome,usage:TokenUsage):Promise<AdmissionReceipt>;
}
export type AdmissionScope=Omit<AdmissionRequest,'fingerprint'>;
type Answer=ProviderResult<{text:string;usage:TokenUsage}>;
const fail=(code:'INVALID_INPUT'|'CANCELLED'|'TIMEOUT'|'NETWORK'|'ADMISSION_DENIED'|'ADMISSION_UNAVAILABLE'):Answer=>({ok:false,code});
const unknownUsage:TokenUsage={inputTokens:null,outputTokens:null};
const key=(s:string)=>typeof s==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(s);

// A lost RPC can still commit remotely. Observe late rejection, but never use a
// late grant or retry it. The persisted lease, not this timer, fences duplicates.
function bounded<T>(operation:()=>Promise<T>,ms:number,signal?:AbortSignal):Promise<T> {
  return new Promise((resolve,reject)=>{
    if(ms<=0||signal?.aborted){reject(Error('Interrupted'));return;}
    let settled=false;
    const done=(run:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);run();};
    const abort=()=>done(()=>reject(Error('Interrupted')));
    const timer=setTimeout(abort,ms);
    signal?.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>{if(settled||signal?.aborted)throw Error('Interrupted');return operation();})
      .then(value=>done(()=>resolve(value)),()=>done(()=>reject(Error('Unavailable'))));
  });
}

/** One server-issued logical attempt per scope. Preserve its original dated ID
 * across retries; never accept a browser-chosen issuance day. Callers still own
 * auth/CSRF, domain idempotency and result caching. This wrapper cannot recover
 * an answer lost after inference and deliberately never re-runs that inference.
 */
export function createAdmittedProvider(provider:LLMProvider,port:AdmissionPort,scope:AdmissionScope):LLMProvider {
  const identity={id:scope.id,userKey:scope.userKey,sessionKey:scope.sessionKey};
  return {contractVersion:1,id:provider.id,model:provider.model,async generate(input,suppliedContext):Promise<Answer>{
    const context={...suppliedContext};
    if(!key(identity.userKey)||!key(identity.sessionKey)||
      !/^(0|[1-9][0-9]{0,8}):[a-zA-Z0-9_-]{1,90}$/.test(identity.id)||
      !valid(input,context))return fail('INVALID_INPUT');
    if(context.signal?.aborted)return fail('CANCELLED');
    const end=Date.now()+context.timeoutMs;
    const copy:ChatInput={messages:input.messages.map(m=>({role:m.role,content:m.content})),
      maxOutputTokens:input.maxOutputTokens,temperature:input.temperature,output:input.output};
    // Pin the exact payload before the first await (including model and limits).
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([
      1,provider.id,provider.model,copy,context.maxResponseBytes??65536
    ])));
    const request:AdmissionRequest={...identity,fingerprint:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};
    const interrupted=()=>context.signal?.aborted?'CANCELLED' as const:Date.now()>=end?'TIMEOUT' as const:'ADMISSION_UNAVAILABLE' as const;
    const rpc=(operation:()=>Promise<AdmissionReceipt>)=>bounded(operation,Math.min(1000,end-Date.now()),context.signal);
    let owned=false;
    const cancel=async()=>{if(owned)try{await bounded(()=>port.cancel(request),1000);}catch{/* lease remains charged until expiry */}};
    let receipt:AdmissionReceipt;
    try {
      receipt=await rpc(()=>port.admit(request));
      // Only this call's new queue/grant is owned. Never cancel or poll an
      // EXISTING request: it may be running in another worker/tab.
      owned=receipt?.code==='QUEUED'&&receipt.phase==='queued'&&receipt.start===false||
        receipt?.code==='ACCEPTED'&&receipt.phase==='running'&&receipt.start===true;
      const queueEnd=Math.min(end,Date.now()+5000);
      let polls=0;
      while(receipt?.code==='QUEUED'&&receipt.phase==='queued'&&receipt.start===false&&polls++<20&&Date.now()<queueEnd){
        await bounded(()=>new Promise<void>(resolve=>setTimeout(resolve,250)),Math.min(251,queueEnd-Date.now()),context.signal);
        receipt=await rpc(()=>port.poll(request));
      }
    }catch{await cancel();return fail(interrupted());}
    if(receipt?.code!=='ACCEPTED'||receipt.phase!=='running'||receipt.start!==true){
      await cancel();return fail('ADMISSION_DENIED');
    }
    // Both caller deadline and persisted lease bound execution. Leave a small
    // guard for dispatch; never extend a provider timeout past the granted lease.
    const now=Date.now(),lease=receipt.deadline;
    if(!Number.isSafeInteger(lease)||typeof lease!=='number'||lease<=now||lease>now+60000){
      await cancel();return fail('ADMISSION_UNAVAILABLE');
    }
    const remaining=Math.min(end,lease-50)-now;
    if(context.signal?.aborted||remaining<1){await cancel();return fail(context.signal?.aborted?'CANCELLED':'TIMEOUT');}
    const controller=new AbortController();
    const abort=()=>controller.abort();context.signal?.addEventListener('abort',abort,{once:true});
    let result:Answer;
    try {
      result=await bounded(()=>provider.generate(copy,{...context,timeoutMs:remaining,signal:controller.signal}),remaining,context.signal);
    }catch{result=fail(context.signal?.aborted?'CANCELLED':Date.now()>=now+remaining?'TIMEOUT':'NETWORK');}
    finally{controller.abort();context.signal?.removeEventListener('abort',abort);}
    if(!result.ok&&['NETWORK','TIMEOUT','CANCELLED'].includes(result.code)){
      await cancel(); // Unknown inference outcome: keep charge/slot, no refund.
    }else {
      try{await bounded(()=>port.finish(request,result.ok?'success':result.code==='QUOTA'?'quota':'failure',result.ok?result.value.usage:unknownUsage),1000);}
      catch{/* Valid answer may be returned; lost settlement never triggers retry/refund. */}
    }
    return result;
  }};
}

// Provider-v1 bounds, checked before hashing/charging. Domain JSON parsing and
// auth remain upstream; this is not a public untrusted-object deserializer.
function valid(input:ChatInput,context:ProviderContext):boolean {
  if(!input||!context||!Number.isInteger(context.timeoutMs)||context.timeoutMs<1||context.timeoutMs>60000||
    !Number.isInteger(input.maxOutputTokens)||input.maxOutputTokens<1||input.maxOutputTokens>8192||
    !Number.isFinite(input.temperature)||input.temperature<0||input.temperature>2||
    !['text','json'].includes(input.output)||!Array.isArray(input.messages)||input.messages.length<1||input.messages.length>32)return false;
  if(context.maxResponseBytes!==undefined&&(!Number.isInteger(context.maxResponseBytes)||context.maxResponseBytes<1||context.maxResponseBytes>65536))return false;
  let length=0;
  for(const m of input.messages){if(!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')return false;length+=m.content.length;}
  return length<=32768;
}
