import {parseMutation,parseSnapshot} from './protocol.js';

// Shell-side adapter. Not enabled in the legacy game until its v1 receiver exists.
// The channel identifies an iframe lifetime, NOT an authentication credential.
export class CourtUnityBridge {
 #transport; #origin; #peer=null; #channel=''; #generation=0; #sequence=0; #busy=false;
 constructor({transport,origin}) {
  if(new URL(origin).origin!==origin||!/^https?:/.test(origin))throw new TypeError('Invalid bridge origin');
  this.#transport=transport;this.#origin=origin;
 }
 bind(peer,sessionId,caseId){
  if(!peer||typeof peer.postMessage!=='function')throw new TypeError('Invalid frame');
  this.clear();this.#transport.bind(sessionId,caseId);this.#peer=peer;this.#channel=crypto.randomUUID();
  this.#send({type:'court-v1-bind',sessionId,caseId});
 }
 clear(){
  if(this.#peer)this.#send({type:'court-v1-clear'});
  this.#generation++;this.#peer=null;this.#channel='';this.#sequence=0;this.#busy=false;this.#transport.clear();
 }
 #send(body){this.#peer?.postMessage({...body,apiVersion:1,channel:this.#channel},this.#origin);}
 async receive(event){
  if(!this.#peer||event.origin!==this.#origin||event.source!==this.#peer)return 'wrong-source';
  const m=event.data;
  if(!m||typeof m!=='object'||Array.isArray(m)||m.apiVersion!==1||m.channel!==this.#channel)return 'wrong-channel';
  const keys=['type','apiVersion','channel','sequence','expectedStateVersion','actionId','targetId','text'];
  if(Object.keys(m).length!==keys.length||!keys.every(k=>Object.hasOwn(m,k))||m.type!=='court-v1-command'||
   !Number.isSafeInteger(m.sequence)||m.sequence<=this.#sequence||!Number.isSafeInteger(m.expectedStateVersion)||m.expectedStateVersion<0)return 'malformed';
  // Reuse strict input bounds/Unicode checks; IDs and authority come from shell.
  const snapshot=this.#transport.snapshot;
  const probe={apiVersion:1,requestId:this.#channel,idempotencyKey:this.#channel,sessionId:snapshot?.sessionId||this.#channel,caseId:snapshot?.caseId||'loading',expectedStateVersion:m.expectedStateVersion,actionId:m.actionId,targetId:m.targetId,text:m.text};
  if(!parseMutation(JSON.stringify(probe)))return 'malformed';
  const controls=['refresh','recover','retry'];
  if(controls.includes(m.actionId)&&(m.targetId!==''||m.text!==''))return 'malformed';
  this.#sequence=m.sequence;
  if(this.#busy){this.#send({type:'court-v1-result',sequence:m.sequence,status:'busy',canAct:false});return 'busy';}
  const generation=this.#generation;this.#busy=true;
  let status;
  try{
   if(m.actionId==='refresh')status=await this.#transport.refresh();
   else if(m.actionId==='recover')status=await this.#transport.recoverPending();
   else if(m.actionId==='retry')status=await this.#transport.retry();
   else if(!snapshot||snapshot.stateVersion!==m.expectedStateVersion)status='needs-snapshot';
   else status=await this.#transport.act(m.actionId,{targetId:m.targetId,text:m.text});
  }catch{status='unavailable';}
  if(generation!==this.#generation)return 'obsolete-context';
  this.#busy=false;
  // Explicit projection only: never send transport, cookies, CSRF or exceptions.
  const current=this.#transport.snapshot;
  if(current&&parseSnapshot(JSON.stringify(current)))this.#send({type:'court-v1-snapshot',sequence:m.sequence,payload:JSON.stringify(current)});
  if(status==='login-required')this.#send({type:'court-v1-clear'});
  this.#send({type:'court-v1-result',sequence:m.sequence,status,canAct:this.#transport.canAct});
  return status;
 }
}
