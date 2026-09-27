import {CourtClientState} from './client-state.js';
import {parseSnapshot,parseEvent,parseMutation,MAX_PROTOCOL_BYTES} from './protocol.js';

// Opt-in v1 transport. No runtime imports until real v1 endpoints are available.
// Cookies/CSRF remain in the shell, never in Unity projections or localStorage.
export class CourtTransport {
 #store=new CourtClientState(); #context=null; #pending=null; #controllers=new Set();
 #fetch; #csrf; #origin; #uuid; #now; #timeout; #ready=false;
 constructor({origin,csrf,fetchImpl=globalThis.fetch,uuid=()=>crypto.randomUUID(),now=()=>Date.now(),timeoutMs=15000}) {
  const u=new URL(origin);
  if(u.origin!==origin||!['http:','https:'].includes(u.protocol)||typeof csrf!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new TypeError('Invalid transport configuration');
  this.#origin=origin;this.#csrf=csrf;this.#fetch=fetchImpl;this.#uuid=uuid;this.#now=now;this.#timeout=timeoutMs;
 }
 get snapshot(){return this.#store.snapshot;}
 get canAct(){return this.#ready&&!this.#pending&&Boolean(this.#context);}
 get pending(){return this.#pending?{requestId:this.#pending.value.requestId,attempts:this.#pending.attempts,inFlight:this.#pending.inFlight,retryAt:this.#pending.retryAt}:null;}
 bind(sessionId,caseId){
  // Reuse exact protocol checks without accepting any caller-supplied URL.
  const probe={apiVersion:1,requestId:this.#uuid(),idempotencyKey:this.#uuid(),sessionId,caseId,expectedStateVersion:0,actionId:'bind',targetId:'',text:''};
  if(!parseMutation(JSON.stringify(probe)))throw new TypeError('Invalid court context');
  this.clear();this.#context={sessionId,caseId};this.#store.bind(sessionId,caseId);
 }
 clear(){for(const c of this.#controllers)c.abort();this.#controllers.clear();this.#pending=null;this.#ready=false;this.#context=null;this.#store.clear();}
 async #exchange(path,{method='GET',body}={}){
  const generation=this.#store.generation,controller=new AbortController();this.#controllers.add(controller);
  let timer,onAbort,timedOut=false;
  const deadline=new Promise(resolve=>{onAbort=()=>resolve({error:timedOut?'timeout':'cancelled'});controller.signal.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>{timedOut=true;controller.abort();},this.#timeout);});
  const run=async()=>{
   try{
    const headers={Accept:'application/json'};
    if(body!==undefined){const token=this.#csrf();if(typeof token!=='string'||!token)return {error:'csrf-unavailable'};headers['Content-Type']='application/json';headers['X-CSRF-Token']=token;}
    const r=await this.#fetch(this.#origin+path,{method,body,headers,credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
    if(!r.ok){await r.body?.cancel();const delay=Number(r.headers.get('Retry-After'));return {status:r.status,retryMs:Number.isFinite(delay)&&delay>0?Math.min(delay*1000,120000):1000};}
    if(Number(r.headers.get('Content-Length'))>MAX_PROTOCOL_BYTES){await r.body?.cancel();return {error:'malformed'};}
    if(!r.body)return {error:'malformed'};
    const reader=r.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let raw='',bytes=0;
    const cancelReader=()=>{void reader.cancel().catch(()=>{});};
    controller.signal.addEventListener('abort',cancelReader,{once:true});
    if(controller.signal.aborted)cancelReader();
    try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>MAX_PROTOCOL_BYTES){await reader.cancel();return {error:'malformed'};}raw+=decoder.decode(chunk.value,{stream:true});}raw+=decoder.decode();}
    finally{controller.signal.removeEventListener('abort',cancelReader);reader.releaseLock();}
    return {status:r.status,raw};
   }catch{return {error:controller.signal.aborted?'cancelled':'network'};}
  };
  try{const result=await Promise.race([run(),deadline]);return generation===this.#store.generation?result:{error:'obsolete-context'};}
  finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);this.#controllers.delete(controller);}
 }
 #path(){return '/api/court/v1/sessions/'+this.#context.sessionId;}
 #error(result){
  if(result.status===401){this.clear();return 'login-required';}
  if(result.status===403)return 'forbidden';
  if(result.status===409)return 'conflict';
  if(result.status===429)return 'rate-limited';
  return result.error||(result.status>=500?'unavailable':'rejected');
 }
 async refresh(){
  if(!this.#context)return 'no-context';
  const generation=this.#store.generation,requestId=this.#uuid();
  const result=await this.#exchange(this.#path()+'?requestId='+encodeURIComponent(requestId));
  if(generation!==this.#store.generation)return 'obsolete-context';
  if(!result.raw){this.#ready=false;return this.#error(result);}
  const s=parseSnapshot(result.raw);
  if(!s||s.requestId!==requestId){this.#ready=false;return 'malformed';}
  const accepted=this.#store.acceptSnapshot(result.raw,generation);
  this.#ready=['accepted','duplicate','stale'].includes(accepted)&&Boolean(this.#store.snapshot);
  return accepted;
 }
 async act(actionId,{targetId='',text=''}={}){
  if(!this.canAct)return this.#pending?'pending':'needs-snapshot';
  const s=this.#store.snapshot;
  const value={apiVersion:1,requestId:this.#uuid(),idempotencyKey:this.#uuid(),...this.#context,expectedStateVersion:s.stateVersion,actionId,targetId,text};
  const body=JSON.stringify(value);if(!parseMutation(body))return 'malformed';
  // UI convenience only; the server must enforce legality and targets again.
  if(!s.state.allowedActions.some(a=>a.actionId===actionId&&a.enabled))return 'not-allowed';
  this.#pending={value,body,attempts:0,inFlight:false,retryAt:0};
  return this.retry();
 }
 async retry(){
  const p=this.#pending;if(!p)return 'no-pending';
  if(p.inFlight)return 'pending';
  if(p.attempts>=3)return 'retry-exhausted';
  if(this.#now()<p.retryAt)return 'rate-limited';
  const generation=this.#store.generation;
  p.inFlight=true;p.attempts++;
  const result=await this.#exchange(this.#path()+'/actions',{method:'POST',body:p.body});
  if(generation!==this.#store.generation||this.#pending!==p)return 'obsolete-context';
  p.inFlight=false;
  if(!result.raw){
   this.#ready=false;
   if([400,403,404,409,422].includes(result.status)||result.error==='csrf-unavailable')this.#pending=null;
   // A timeout or server error does NOT prove a mutation failed. Keep original
   // bytes and IDs, block new actions; explicit retry only, maximum 3 attempts.
   p.retryAt=this.#now()+(result.retryMs||1000);
   return this.#error(result);
  }
  return this.#acceptResult(result.raw,p,generation);
 }
 // Read the recorded outcome without issuing another mutation/provider call.
 // A 404 is not evidence of failure (the original request may still be running).
 async recoverPending(){
  const p=this.#pending;if(!p)return 'no-pending';if(p.inFlight)return 'pending';
  const generation=this.#store.generation;p.inFlight=true;
  const result=await this.#exchange(this.#path()+'/requests/'+p.value.requestId);
  if(generation!==this.#store.generation||this.#pending!==p)return 'obsolete-context';
  p.inFlight=false;
  if(!result.raw){this.#ready=false;return result.status===404?'outcome-unknown':this.#error(result);}
  return this.#acceptResult(result.raw,p,generation);
 }
 #acceptResult(raw,p,generation){
  const e=parseEvent(raw);
  if(!e||e.requestId!==p.value.requestId){this.#ready=false;return 'malformed';}
  const accepted=this.#store.acceptEvent(raw,generation);
  if(['accepted','duplicate','stale'].includes(accepted)){
   this.#pending=null;this.#ready=true;
  }else this.#ready=false;
  return accepted;
 }
}
