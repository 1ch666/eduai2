import {CourtClientState} from './client-state.js';
import {parseMutation} from './protocol.js';
const exact=(m,keys)=>m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).length===keys.length&&keys.every(k=>Object.hasOwn(m,k));
const base=['type','apiVersion','channel'];
const statuses=new Set('accepted duplicate stale malformed conflict gap needs-snapshot no-context no-pending pending busy not-allowed timeout cancelled obsolete-context network csrf-unavailable login-required forbidden rate-limited unavailable rejected retry-exhausted outcome-unknown'.split(' '));

// Frame side: no fetch, cookies, CSRF or legal decisions. Callbacks are explicit
// integration seams for Unity; this module does not select a GameObject by input.
export class CourtUnityReceiver {
 #parent; #origin; #channel=''; #context=null; #sequence=0; #pending=0; #ready=false;
 #state=new CourtClientState(); #onSnapshot; #onClear; #onStatus; #validReply=false;
 #timer=null; #schedule; #cancel; #timeout;
 constructor({parent,origin,onSnapshot,onClear,onStatus,timeoutMs=20000,schedule=setTimeout,cancel=clearTimeout}){
  if(!parent||typeof parent.postMessage!=='function'||new URL(origin).origin!==origin||!/^https?:/.test(origin)||[onSnapshot,onClear,onStatus].some(x=>typeof x!=='function'))throw new TypeError('Invalid receiver');
  this.#parent=parent;this.#origin=origin;this.#onSnapshot=onSnapshot;this.#onClear=onClear;this.#onStatus=onStatus;
  if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>120000||typeof schedule!=='function'||typeof cancel!=='function')throw new TypeError('Invalid deadline');
  this.#timeout=timeoutMs;this.#schedule=schedule;this.#cancel=cancel;
 }
 get canAct(){return this.#ready&&!this.#pending&&!!this.#state.snapshot;}
 #stopTimer(){if(this.#timer!==null)this.#cancel(this.#timer);this.#timer=null;}
 clear(){this.#stopTimer();this.#channel='';this.#context=null;this.#sequence=0;this.#pending=0;this.#ready=false;this.#validReply=false;this.#state.clear();this.#onClear();}
 receive(event){
  if(event.source!==this.#parent||event.origin!==this.#origin)return 'wrong-source';
  const m=event.data;if(!m||m.apiVersion!==1)return 'malformed';
  if(m.type==='court-v1-bind'){
   if(!exact(m,[...base,'sessionId','caseId'])||!parseMutation(JSON.stringify({apiVersion:1,requestId:m.channel,idempotencyKey:m.channel,sessionId:m.sessionId,caseId:m.caseId,expectedStateVersion:0,actionId:'bind',targetId:'',text:''})))return 'malformed';
   if(m.channel===this.#channel)return 'duplicate';
   this.clear();this.#channel=m.channel;this.#context={sessionId:m.sessionId,caseId:m.caseId};this.#state.bind(m.sessionId,m.caseId);return 'bound';
  }
  if(!this.#channel||m.channel!==this.#channel)return 'wrong-channel';
  if(m.type==='court-v1-clear'&&exact(m,base)){this.clear();return 'cleared';}
  if(!this.#pending||m.sequence!==this.#pending)return 'uncorrelated';
  if(m.type==='court-v1-snapshot'&&exact(m,[...base,'sequence','payload'])){
   const result=this.#state.acceptSnapshot(m.payload,this.#state.generation);
   if(result==='accepted')this.#onSnapshot(JSON.stringify(this.#state.snapshot));
   this.#validReply=['accepted','duplicate','stale'].includes(result);
   if(!this.#validReply)this.#ready=false;
   return result;
  }
  if(m.type==='court-v1-result'&&exact(m,[...base,'sequence','status','canAct'])&&statuses.has(m.status)&&typeof m.canAct==='boolean'){
   this.#stopTimer();this.#pending=0;this.#ready=m.canAct&&this.#validReply;this.#onStatus(m.status,this.canAct);return m.status;
  }
  return 'malformed';
 }
 command(actionId,{targetId='',text=''}={}){
  if(!this.#context)return 'no-context';if(this.#pending)return 'pending';
  const control=['refresh','recover','retry'].includes(actionId);
  if(!control&&!this.canAct)return 'needs-snapshot';
  if(control&&(targetId!==''||text!==''))return 'malformed';
  const expectedStateVersion=this.#state.snapshot?.stateVersion??0;
  if(!parseMutation(JSON.stringify({apiVersion:1,requestId:this.#channel,idempotencyKey:this.#channel,...this.#context,expectedStateVersion,actionId,targetId,text})))return 'malformed';
  if(this.#sequence>=Number.MAX_SAFE_INTEGER)return 'rebind-required';
  this.#pending=++this.#sequence;this.#ready=false;this.#validReply=false;
  const sequence=this.#sequence,channel=this.#channel;
  this.#timer=this.#schedule(()=>{
   if(this.#channel!==channel||this.#pending!==sequence)return;
   this.#timer=null;this.#pending=0;this.#ready=false;this.#validReply=false;
   // Delivery timeout is indeterminate. Never resend an action automatically.
   // Keep state read-only; the user may ask the shell for its recorded outcome.
   this.#onStatus('timeout',false);
  },this.#timeout);
  try{this.#parent.postMessage({type:'court-v1-command',apiVersion:1,channel:this.#channel,sequence,expectedStateVersion,actionId,targetId,text},this.#origin);}
  catch{this.#stopTimer();this.#pending=0;this.#onStatus('unavailable',false);return 'unavailable';}
  return 'sent';
 }
}
