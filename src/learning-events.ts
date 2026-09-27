import {canonical} from '../court/protocol.js';

export const LEARNING_RETENTION_MS=30*86400000;
export const LEARNING_MAX_EVENTS=1000;
const MAX_EVENT_AGE=86400000;
const kinds=['concept_mastery','repeated_error','evidence_reasoning_error','procedure_error','hint_dependency','completion'] as const;
export type LearningEvent={schemaVersion:1;eventVersion:1;eventId:string;anonymousId:string;occurredAt:number;
 kind:typeof kinds[number];conceptId:string|null;value:number;sampleSize:number};
export type LearningEventState={schemaVersion:1;clock:number;events:LearningEvent[]};
export type LearningEventPolicy={anonymousId:string;conceptIds:ReadonlySet<string>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const integer=(v:unknown,max=8e15):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
function record(v:unknown,keys:string[]):Record<string,unknown>|null{
 if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length)return null;
 const result:Record<string,unknown>={};
 for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value' in d)||!d.enumerable)return null;result[k]=d.value;}
 return result;
}
export function parseLearningEvent(input:unknown,policy:LearningEventPolicy):LearningEvent|null{
 try{
  const v=record(input,['schemaVersion','eventVersion','eventId','anonymousId','occurredAt','kind','conceptId','value','sampleSize']);
  if(!v||v.schemaVersion!==1||v.eventVersion!==1||!uuid(v.eventId)||!uuid(v.anonymousId)||
   v.anonymousId!==policy.anonymousId||!integer(v.occurredAt)||typeof v.kind!=='string'||!kinds.includes(v.kind as LearningEvent['kind'])||
   !integer(v.value,1000)||!integer(v.sampleSize,1000)||v.sampleSize<1||v.value>v.sampleSize)return null;
  if(v.kind==='completion'){if(v.conceptId!==null)return null;}
  else if(typeof v.conceptId!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(v.conceptId)||!policy.conceptIds.has(v.conceptId))return null;
  return {schemaVersion:1,eventVersion:1,eventId:v.eventId,anonymousId:v.anonymousId,occurredAt:v.occurredAt,
   kind:v.kind as LearningEvent['kind'],conceptId:v.conceptId as string|null,value:v.value,sampleSize:v.sampleSize};
 }catch{return null;}
}
export function parseLearningEventState(input:unknown,policy:LearningEventPolicy):LearningEventState|null{
 try{
  const v=record(input,['schemaVersion','clock','events']);
  if(!v||v.schemaVersion!==1||!integer(v.clock)||!Array.isArray(v.events)||Object.getPrototypeOf(v.events)!==Array.prototype||
   v.events.length>LEARNING_MAX_EVENTS||Reflect.ownKeys(v.events).length!==v.events.length+1)return null;
  const events:LearningEvent[]=[],ids=new Set<string>();
  for(let i=0;i<v.events.length;i++){
   const d=Object.getOwnPropertyDescriptor(v.events,String(i));if(!d||!('value' in d))return null;
   const e=parseLearningEvent(d.value,policy);
   if(!e||e.occurredAt>v.clock||e.occurredAt<=v.clock-LEARNING_RETENTION_MS||ids.has(e.eventId))return null;
   ids.add(e.eventId);events.push(e);
  }
  return {schemaVersion:1,clock:v.clock,events};
 }catch{return null;}
}

/** Pure server-side reducer. Host must supply trusted consent, catalog, anonymous
 * scope and clock; persist atomically and arrange expiry alarms before collection.
 * No HTTP route, account mapping, model call or telemetry side effects here.
 */
export function reduceLearningEvents(input:unknown,event:unknown,now:number,policy:LearningEventPolicy,enabled=false){
 const state=parseLearningEventState(input,policy);
 if(!state||!integer(now)||now<state.clock)return {code:'INVALID_STATE' as const,state:null};
 if(enabled!==true)return {code:'DISABLED' as const,state};
 const next:LearningEventState={schemaVersion:1,clock:now,events:state.events.filter(e=>e.occurredAt>now-LEARNING_RETENTION_MS)};
 // null is an explicit maintenance tick. Empty/corrupt records are not repaired.
 if(event===null)return {code:'PRUNED' as const,state:next};
 const parsed=parseLearningEvent(event,policy);
 if(!parsed)return {code:'INVALID_EVENT' as const,state:next};
 const prior=next.events.find(e=>e.eventId===parsed.eventId);
 if(prior)return {code:canonical(prior)===canonical(parsed)?'DUPLICATE' as const:'CONFLICT' as const,state:next};
 if(parsed.occurredAt>now||parsed.occurredAt<now-MAX_EVENT_AGE)return {code:'EXPIRED_EVENT' as const,state:next};
 // Do not evict still-valid IDs: that would allow repeated counting on replay.
 if(next.events.length>=LEARNING_MAX_EVENTS)return {code:'FULL' as const,state:next};
 next.events.push(parsed);return {code:'ACCEPTED' as const,state:next};
}
