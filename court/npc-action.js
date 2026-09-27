import {actionTargetStatus} from './action-targets.js';

// Legacy Unity messages have a UI ticket, not an HTTP request ID. Keep bounded
// per-context receipts so duplicated window messages cannot create fresh actions.
export function createNpcTicketGate(){
 let context=null,entries=new Map();
 return {run(scope,ticket,npcId,text,submit){
  if(scope!==context){context=scope;entries=new Map();}
  const payload=JSON.stringify([npcId,text]),previous=entries.get(ticket);
  if(previous)return previous.payload===payload?previous.result:Promise.resolve('conflict');
  if(entries.size>=40)return Promise.resolve('rate-limited');
  const result=Promise.resolve().then(submit);
  entries.set(ticket,{payload,result});return result;
 },clear(){context=null;entries.clear();}};
}

// The web shell owns the transport. Unity supplies a target/question only, never
// authoritative versions, provider credentials or transport request IDs.
export async function askNpcThroughTransport(transport,npcId,text,isCurrent=()=>true){
 if(typeof text!=='string'||!text.trim()||text.length>400)return 'malformed';
 if(transport.pending)return 'pending';
 if(transport.recoveryBlocked)return 'persistence-unavailable';
 const refreshed=await transport.refresh();
 if(!isCurrent())return 'obsolete-context';
 if(!['accepted','duplicate','stale'].includes(refreshed))return refreshed;
 const snapshot=transport.snapshot,action=snapshot?.state.allowedActions.find(a=>a.actionId==='npc.ask');
 if(!action||!actionTargetStatus(snapshot,action,npcId).enabled)return 'not-allowed';
 return transport.act(action.actionId,{targetId:npcId,text});
}
