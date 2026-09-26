import { parseSnapshot, parseEvent, canonical } from './protocol.js';

// Side-effect-free reference store. Runtime/Unity integration is deliberately
// gated until the server publishes real v1 projections and event history.
export class CourtClientState {
 #context=null;
 #snapshot=null;
 #generation=0;
 get generation(){return this.#generation;}
 get snapshot(){return this.#snapshot===null?null:structuredClone(this.#snapshot);}
 bind(sessionId,caseId){
  this.clear();this.#context={sessionId,caseId};return this.#generation;
 }
 clear(){this.#context=null;this.#snapshot=null;this.#generation++;}
 #check(next,generation){
  if(generation!==this.#generation||!this.#context)return 'obsolete-context';
  if(!next)return 'malformed';
  if(next.sessionId!==this.#context.sessionId||next.caseId!==this.#context.caseId)return 'wrong-session';
  if(!this.#snapshot)return 'accepted';
  const old=this.#snapshot;
  if(next.stateVersion<old.stateVersion||next.eventSequence<old.eventSequence)return 'stale';
  if(next.stateVersion===old.stateVersion){
   const {requestId:ignoredOld,...a}=old,{requestId:ignoredNew,...b}=next;
   return canonical(a)===canonical(b)?'duplicate':'conflict';
  }
  if(next.eventSequence<=old.eventSequence||next.eventId===old.eventId)return 'conflict';
  return 'accepted';
 }
 acceptSnapshot(raw,generation){
  const next=parseSnapshot(raw),result=this.#check(next,generation);
  if(result==='accepted')this.#snapshot=next;
  return result;
 }
 acceptEvent(raw,generation){
  const event=parseEvent(raw),result=this.#check(event?.snapshot,generation);
  if(result!=='accepted')return result;
  if(!this.#snapshot)return 'needs-snapshot';
  if(event.stateVersion!==this.#snapshot.stateVersion+1||event.eventSequence!==this.#snapshot.eventSequence+1)return 'gap';
  this.#snapshot=event.snapshot;return 'accepted';
 }
}
