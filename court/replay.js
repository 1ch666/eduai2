import {parseEvent,parseMutation,canonical} from './protocol.js';

// A separate, read-only historical store. It intentionally has no transport or
// mutation callback; seeking cannot drive the live state reducer or AI service.
export class CourtReplay {
 #context=null; #events=[]; #index=-1; #playing=false; #elapsed=0; #bytes=0;
 get length(){return this.#events.length;}
 get index(){return this.#index;}
 get playing(){return this.#playing;}
 get current(){return this.#index<0?null:structuredClone(this.#events[this.#index]);}
 get incompletePrefix(){return !!this.#events.length&&this.#events[0].eventSequence!==0;}
 get nextAfter(){return this.#events.at(-1)?.eventSequence??-1;}
 bind(sessionId,caseId){
  const id=crypto.randomUUID();
  if(!parseMutation(JSON.stringify({apiVersion:1,requestId:id,idempotencyKey:id,sessionId,caseId,expectedStateVersion:0,actionId:'replay',targetId:'',text:''})))throw new TypeError('Invalid replay context');
  this.clear();this.#context={sessionId,caseId};
 }
 clear(){this.#context=null;this.#events=[];this.#index=-1;this.#bytes=0;this.pause();}
 // Caller must supply authenticated server events, not local/user imports.
 // Validate a whole page before appending any item. Reject gaps instead of
 // inventing transitions or silently dropping missing testimony.
 append(rawEvents){
  if(!this.#context)return 'no-context';
  if(!Array.isArray(rawEvents)||rawEvents.length>20)return 'malformed';
  const additions=[];let bytes=this.#bytes;
  const known=new Map(this.#events.map(e=>[e.eventSequence,e]));
  const ids=new Set(this.#events.map(e=>e.eventId));
  let last=this.#events.at(-1);
  for(const raw of rawEvents){
   const e=parseEvent(raw);if(!e)return this.#reject('malformed');
   if(e.sessionId!==this.#context.sessionId||e.caseId!==this.#context.caseId)return this.#reject('wrong-session');
   const previous=known.get(e.eventSequence);
   if(previous){if(canonical(previous)!==canonical(e))return this.#reject('conflict');continue;}
   if(ids.has(e.eventId))return this.#reject('conflict');
   if(last&&(e.eventSequence!==last.eventSequence+1||e.stateVersion!==last.stateVersion+1))return this.#reject('gap');
   if(!last&&e.kind!=='session_started'&&e.kind!=='checkpoint')return this.#reject('needs-prefix');
   bytes+=new TextEncoder().encode(raw).byteLength;
   if(this.#events.length+additions.length>=200||bytes>8*1024*1024)return this.#reject('capacity');
   additions.push(e);known.set(e.eventSequence,e);ids.add(e.eventId);last=e;
  }
  this.#events.push(...additions);this.#bytes=bytes;
  if(this.#index<0&&this.#events.length)this.#index=0;
  return additions.length?'accepted':'duplicate';
 }
 #reject(status){this.pause();return status;}
 pause(){this.#playing=false;this.#elapsed=0;}
 play(){this.#elapsed=0;this.#playing=this.#index>=0&&this.#index<this.#events.length-1;return this.#playing;}
 seek(index){
  if(!Number.isInteger(index)||index<0||index>=this.#events.length)return false;
  this.pause();this.#index=index;return true;
 }
 jump(eventId){return this.seek(this.#events.findIndex(e=>e.eventId===eventId));}
 step(direction=1){return (direction===1||direction===-1)&&this.seek(this.#index+direction);}
 // Display pacing only, not a reconstructed legal timestamp. Host supplies
 // monotonic elapsed milliseconds; background suspension cannot skip the record.
 tick(elapsedMs){
  if(!this.#playing||!Number.isFinite(elapsedMs)||elapsedMs<0)return false;
  this.#elapsed+=Math.min(elapsedMs,1000);
  if(this.#elapsed<1000)return false;
  this.#elapsed=0;this.#index++;
  if(this.#index>=this.#events.length-1)this.pause();
  return true;
 }
 transcript({roleId='',stageId='',evidenceId='',query='',kind=''}={}){
  if([roleId,stageId,evidenceId,query,kind].some(s=>typeof s!=='string'||s.length>400))return [];
  const needle=query.trim().toLocaleLowerCase('zh-TW');
  // Return only records up to the playhead, so later evidence/statements do not
  // leak into an earlier moment. Plain strings; callers must use text rendering.
  return this.#events.slice(0,this.#index+1).filter(e=>(!roleId||e.roleId===roleId)&&(!stageId||e.stageId===stageId)&&(!kind||e.kind===kind)&&(!evidenceId||e.evidenceIds.includes(evidenceId))&&(!needle||(e.speaker+' '+e.text).toLocaleLowerCase('zh-TW').includes(needle)))
   .map(e=>({eventId:e.eventId,eventSequence:e.eventSequence,stateVersion:e.stateVersion,speaker:e.speaker,roleId:e.roleId,timestamp:e.timestamp,stageId:e.stageId,stageLabel:e.snapshot.state.stageLabel,kind:e.kind,text:e.text,evidenceIds:[...e.evidenceIds],citationIds:[...e.citationIds]}));
 }
}
