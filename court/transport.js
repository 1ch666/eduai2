import {CourtClientState} from './client-state.js';
import {parseSnapshot,parseEvent,parseMutation,parseNotApplied,MAX_PROTOCOL_BYTES} from './protocol.js';

// Versioned transport used by the server action panel and read-only HUD relay.
// Cookies/CSRF remain in the shell, never in Unity projections or localStorage.
export class CourtTransport {
 #store=new CourtClientState(); #context=null; #pending=null; #controllers=new Set();
 #fetch; #csrf; #origin; #uuid; #now; #timeout; #ready=false;
 #journalFactory; #journal=null; #journalBlocked=false; #lastDialogue=null;
 constructor({origin,csrf,fetchImpl=(...args)=>globalThis.fetch(...args),uuid=()=>crypto.randomUUID(),now=()=>Date.now(),timeoutMs=15000,journalFactory=null}) {
  const u=new URL(origin);
  if(u.origin!==origin||!['http:','https:'].includes(u.protocol)||typeof csrf!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new TypeError('Invalid transport configuration');
  this.#origin=origin;this.#csrf=csrf;this.#fetch=fetchImpl;this.#uuid=uuid;this.#now=now;this.#timeout=timeoutMs;
  if(journalFactory!==null&&typeof journalFactory!=='function')throw new TypeError('Invalid journal');this.#journalFactory=journalFactory;
 }
 get snapshot(){return this.#store.snapshot;}
 get lastDialogue(){return this.#lastDialogue?{...this.#lastDialogue}:null;}
 get canAct(){return this.#ready&&!this.#pending&&!this.#journalBlocked&&Boolean(this.#context);}
 get recoveryBlocked(){return this.#journalBlocked;}
 get pending(){return this.#pending?{requestId:this.#pending.value.requestId,attempts:this.#pending.attempts,inFlight:this.#pending.inFlight,retryAt:this.#pending.retryAt}:null;}
 bind(sessionId,caseId){
  // Reuse exact protocol checks without accepting any caller-supplied URL.
  const probe={apiVersion:1,requestId:this.#uuid(),idempotencyKey:this.#uuid(),sessionId,caseId,expectedStateVersion:0,actionId:'bind',targetId:'',text:''};
  if(!parseMutation(JSON.stringify(probe)))throw new TypeError('Invalid court context');
  this.clear();this.#context={sessionId,caseId};this.#store.bind(sessionId,caseId);
  if(this.#journalFactory)try{
   this.#journal=this.#journalFactory(this.#context);const requestId=this.#journal.read();
   if(requestId){
    if(!parseMutation(JSON.stringify({...probe,requestId})))throw new TypeError('Invalid pending marker');
    this.#pending={value:{requestId},body:null,attempts:3,inFlight:false,retryAt:0,restored:true};
   }
  }catch{this.#journalBlocked=true;}
 }
 clear(){for(const c of this.#controllers)c.abort();this.#controllers.clear();this.#pending=null;this.#ready=false;this.#context=null;this.#store.clear();this.#journal=null;this.#journalBlocked=false;this.#lastDialogue=null;}
 async #exchange(path,{method='GET',body}={}){
  const generation=this.#store.generation,controller=new AbortController();this.#controllers.add(controller);
  let timer,onAbort,timedOut=false;
  const deadline=new Promise(resolve=>{onAbort=()=>resolve({error:timedOut?'timeout':'cancelled'});controller.signal.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>{timedOut=true;controller.abort();},this.#timeout);});
  const run=async()=>{
   try{
    const headers={Accept:'application/json'};
    if(body!==undefined){const token=this.#csrf();if(typeof token!=='string'||!token)return {error:'csrf-unavailable'};headers['Content-Type']='application/json';headers['X-CSRF-Token']=token;}
    const r=await this.#fetch(this.#origin+path,{method,body,headers,credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
    if(!r.ok||r.status===202){await r.body?.cancel();const delay=Number(r.headers.get('Retry-After'));return {status:r.status,retryMs:Number.isFinite(delay)&&delay>0?Math.min(delay*1000,120000):1000};}
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
  if(result.status===202)return 'outcome-unknown';
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
  if(this.#journalBlocked)return 'persistence-unavailable';
  if(!this.canAct)return this.#pending?'pending':'needs-snapshot';
  const s=this.#store.snapshot;
  const value={apiVersion:1,requestId:this.#uuid(),idempotencyKey:this.#uuid(),...this.#context,expectedStateVersion:s.stateVersion,actionId,targetId,text};
  const body=JSON.stringify(value);if(!parseMutation(body))return 'malformed';
  // UI convenience only; the server must enforce legality and targets again.
  if(!s.state.allowedActions.some(a=>a.actionId===actionId&&a.enabled))return 'not-allowed';
  try{this.#journal?.save(value.requestId);}catch{this.#journalBlocked=true;return 'persistence-unavailable';}
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
   // A later rejected retry cannot disprove success of an earlier ambiguous POST.
   if(p.attempts===1&&([400,403,404,409,422].includes(result.status)||result.error==='csrf-unavailable')){
    try{this.#journal?.remove(p.value.requestId);this.#pending=null;this.#journalBlocked=false;}catch{this.#journalBlocked=true;return 'persistence-unavailable';}
   }
   // A timeout or server error does NOT prove a mutation failed. Keep original
   // bytes and IDs, block new actions; explicit retry only, maximum 3 attempts.
   p.retryAt=this.#now()+(result.retryMs||1000);
   return this.#error(result);
  }
  return this.#acceptResult(result.raw,p,generation);
 }
 // Read the recorded outcome without resending an action/provider call. The
 // server may durably expire a pending reservation, never advance court state.
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
  const receipt=parseNotApplied(raw);
  if(receipt){
   if(receipt.requestId!==p.value.requestId||receipt.sessionId!==this.#context?.sessionId||receipt.caseId!==this.#context?.caseId)return 'malformed';
   try{this.#journal?.remove(p.value.requestId);}catch{this.#journalBlocked=true;return 'persistence-unavailable';}
   this.#pending=null;this.#journalBlocked=false;this.#ready=false;this.#lastDialogue=null;return 'not-applied';
  }
  const e=parseEvent(raw);
  if(!e||e.requestId!==p.value.requestId){this.#ready=false;return 'malformed';}
  const accepted=p.restored?this.#store.acceptSnapshot(JSON.stringify(e.snapshot),generation):this.#store.acceptEvent(raw,generation);
  if(['accepted','duplicate','stale'].includes(accepted)){
   try{this.#journal?.remove(p.value.requestId);}catch{this.#journalBlocked=true;return 'persistence-unavailable';}
   this.#pending=null;this.#journalBlocked=false;this.#ready=true;
   if(e.kind==='npc_utterance')this.#lastDialogue={speaker:e.speaker,text:e.text};
  }else this.#ready=false;
  return accepted;
 }
}
