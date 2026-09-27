import {CourtReplay} from './replay.js';
import {parseEventPage,MAX_PROTOCOL_BYTES} from './protocol.js';

// GET-only shell client. Authentication is same-origin HttpOnly cookies; no token
// or private account object is exposed to the historical model or Unity.
export class CourtReplayLoader {
 #origin; #fetch; #timeout; #session=''; #generation=0; #controller=null; #replay=new CourtReplay(); #currentVersion=-1;
 constructor({origin,fetchImpl=(...args)=>globalThis.fetch(...args),timeoutMs=15000}){
  if(new URL(origin).origin!==origin||!/^https?:/.test(origin)||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new TypeError('Invalid replay loader');
  this.#origin=origin;this.#fetch=fetchImpl;this.#timeout=timeoutMs;
 }
 get replay(){return this.#replay;}
 get caughtUp(){return this.#currentVersion>=0&&this.#replay.nextAfter===this.#currentVersion;}
 bind(sessionId,caseId){const next=new CourtReplay();next.bind(sessionId,caseId);this.clear();this.#replay=next;this.#session=sessionId;}
 clear(){this.#generation++;this.#controller?.abort();this.#controller=null;this.#session='';this.#currentVersion=-1;this.#replay.clear();}
 async next(){
  if(!this.#session)return 'no-context';if(this.#controller)return 'pending';
  const generation=this.#generation,after=this.#replay.nextAfter,controller=new AbortController();this.#controller=controller;
  let timer,onAbort,timedOut=false;
  const deadline=new Promise(resolve=>{
   onAbort=()=>resolve({error:timedOut?'timeout':'cancelled'});
   controller.signal.addEventListener('abort',onAbort,{once:true});
   timer=setTimeout(()=>{timedOut=true;controller.abort();},this.#timeout);
  });
  const read=async()=>{
   try{
    const r=await this.#fetch(`${this.#origin}/api/court/sessions/${this.#session}/events?after=${after}`,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});
    if(!r.ok){await r.body?.cancel();return {status:r.status};}
    if(!r.body||Number(r.headers.get('Content-Length'))>MAX_PROTOCOL_BYTES){await r.body?.cancel();return {error:'oversized'};}
    const reader=r.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,raw='';
    const cancel=()=>{void reader.cancel().catch(()=>{});};controller.signal.addEventListener('abort',cancel,{once:true});
    if(controller.signal.aborted)cancel();
    try{
     while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>MAX_PROTOCOL_BYTES){await reader.cancel();return {error:'oversized'};}raw+=decoder.decode(chunk.value,{stream:true});}
     raw+=decoder.decode();return {raw};
    }finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock();}
   }catch{return {error:controller.signal.aborted?'cancelled':'network'};}
  };
  try{
   const result=await Promise.race([read(),deadline]);
   if(generation!==this.#generation)return 'obsolete-context';
   if(result.status===401){this.clear();return 'login-required';}
   if(!result.raw){this.#replay.pause();return result.error||({403:'forbidden',404:'not-found',429:'rate-limited'}[result.status])||'unavailable';}
   const page=parseEventPage(result.raw);
   if(!page||page.nextAfter!== (page.events.at(-1)?.eventSequence??after)||page.nextAfter>page.currentVersion||page.currentVersion<this.#currentVersion||page.events.some(e=>e.eventSequence<=after))return this.#fail('malformed');
   if(!page.events.length&&page.currentVersion>after)return this.#fail('gap');
   const accepted=this.#replay.append(page.events.map(e=>JSON.stringify(e)));
   if(!['accepted','duplicate'].includes(accepted))return this.#fail(accepted);
   this.#currentVersion=page.currentVersion;return this.caughtUp?'caught-up':'more';
  }finally{
   clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);
   if(this.#controller===controller)this.#controller=null;
  }
 }
 #fail(status){this.#replay.pause();return status;}
}
