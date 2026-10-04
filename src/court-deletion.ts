import {parseMutation,canonical,type CourtMutation} from '../court/protocol.js';
import type {CourtState} from './court-rules';
const contents=['state','requests','dialogue','court_dialogue_attempts','npc_requests','court_events','court_v1_requests','court_v1_npc_pending','court_replay_state','court_replay_context'] as const;
export function eraseCourtContent(sql:SqlStorage){for(const table of contents)sql.exec(`DELETE FROM ${table}`);}
export function initializeDeletion(sql:SqlStorage){
 sql.exec('CREATE TABLE IF NOT EXISTS court_v2_deletion(id INTEGER PRIMARY KEY CHECK(id=1),schema_version INTEGER NOT NULL,payload TEXT NOT NULL,event_id TEXT NOT NULL,deleted_at TEXT NOT NULL)');
}
export function parseDeletion(raw:string):CourtMutation|null{
 const m=parseMutation(raw);
 return m&&m.actionId==='session.delete'&&m.targetId===''&&m.text===''&&m.expectedStateVersion<Number.MAX_SAFE_INTEGER?m:null;
}
function receipt(m:CourtMutation,eventId:string,timestamp:string){
 return {apiVersion:2 as const,requestId:m.requestId,idempotencyKey:m.idempotencyKey,
  sessionId:m.sessionId,eventId,previousVersion:m.expectedStateVersion,stateVersion:m.expectedStateVersion+1,timestamp,outcome:'deleted' as const};
}
/** SELECT-only recovery. Never recreate content or invent a receipt for legacy deletion. */
export function deletionOutcome(sql:SqlStorage,owner:string,sessionId:string,requestId:string){
 const guard=sql.exec<{owner:string;deleted_at:string}>('SELECT owner,deleted_at FROM court_deleted WHERE id=1').toArray()[0];
 if(!guard||guard.owner!==owner)return {status:404 as const};
 const old=sql.exec<{schema_version:number;payload:string;event_id:string;deleted_at:string}>('SELECT schema_version,payload,event_id,deleted_at FROM court_v2_deletion WHERE id=1').toArray()[0];
 if(!old)return {status:404 as const};
 const m=parseDeletion(old.payload);
 if(!m||canonical(m)!==old.payload||old.schema_version!==1||old.deleted_at!==guard.deleted_at||
  !Number.isFinite(Date.parse(old.deleted_at))||new Date(old.deleted_at).toISOString()!==old.deleted_at||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(old.event_id))throw Error('Invalid deletion receipt');
 if(m.sessionId!==sessionId||m.requestId!==requestId)return {status:404 as const};
 return receipt(m,old.event_id,old.deleted_at);
}
/** Caller owns the synchronous transaction; no provider, await or public data. */
export function deleteCourt(sql:SqlStorage,owner:string,input:CourtMutation,state:CourtState|undefined){
 const m=parseDeletion(JSON.stringify(input));if(!m)return {status:400 as const};
 const guard=sql.exec<{owner:string;deleted_at:string}>('SELECT owner,deleted_at FROM court_deleted WHERE id=1').toArray()[0];
 if(guard?guard.owner!==owner:!state||state.owner!==owner||state.id!==m.sessionId)return {status:404 as const};
 const payload=canonical(m);
 const old=sql.exec<{schema_version:number;payload:string;event_id:string;deleted_at:string}>('SELECT schema_version,payload,event_id,deleted_at FROM court_v2_deletion WHERE id=1').toArray()[0];
 if(old){
  if(old.schema_version!==1||!guard||old.deleted_at!==guard.deleted_at||!Number.isFinite(Date.parse(old.deleted_at))||
   new Date(old.deleted_at).toISOString()!==old.deleted_at||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(old.event_id))throw Error('Invalid deletion receipt');
  return old.payload===payload?receipt(m,old.event_id,old.deleted_at):{status:409 as const};
 }
 if(guard)return {status:409 as const}; // Legacy deletion has no fabricated v2 receipt.
 if(!state||state.version!==m.expectedStateVersion||state.config.caseId!==m.caseId)return {status:409 as const};
 for(const table of ['court_v1_requests','court_v1_npc_pending']){
  if(sql.exec(`SELECT request_id FROM ${table} WHERE request_id=? OR idempotency_key=?`,m.requestId,m.idempotencyKey).toArray().length)return {status:409 as const};
 }
 for(const table of ['requests','npc_requests'])if(sql.exec(`SELECT id FROM ${table} WHERE id=?`,m.requestId).toArray().length)return {status:409 as const};
 const timestamp=new Date().toISOString(),eventId=crypto.randomUUID();
 sql.exec('INSERT INTO court_deleted VALUES(1,?,?)',owner,timestamp);
 eraseCourtContent(sql);
 sql.exec('INSERT INTO court_v2_deletion VALUES(1,1,?,?,?)',payload,eventId,timestamp);
 return receipt(m,eventId,timestamp);
}
