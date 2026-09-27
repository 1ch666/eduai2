import type {CourtState} from './court-rules';
import {canonical} from '../court/protocol.js';
import {parsePrivateCourtState} from './court-private-state';

// Internal persistence only. Never expose through a Worker route or DO RPC:
// contexts include owner, answer keys and optional role-private graph data.
const contextKeys=['id','owner','config','createdAt','ruleVersion','generatedCase','generationVersion','privateGraph'] as const;
export function initializePrivateJournal(sql:SqlStorage){
 sql.exec(`CREATE TABLE IF NOT EXISTS court_replay_meta(id INTEGER PRIMARY KEY CHECK(id=1),schema_version INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS court_replay_context(id INTEGER PRIMARY KEY,body TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS court_replay_state(version INTEGER PRIMARY KEY,event_id TEXT NOT NULL UNIQUE,context_id INTEGER NOT NULL,body TEXT NOT NULL);
 INSERT OR IGNORE INTO court_replay_meta VALUES(1,1);`);
 const meta=sql.exec<{schema_version:number}>('SELECT schema_version FROM court_replay_meta WHERE id=1').one();
 if(meta.schema_version!==1)throw Error('Unsupported private journal schema');
 // Persisted trigger also protects deletion by a pre-feature Worker rollback.
 // It shares the caller's transaction: a failed delete restores BOTH histories.
 sql.exec(`CREATE TRIGGER IF NOT EXISTS court_replay_erase_on_state_delete_v1
 AFTER DELETE ON state WHEN OLD.id=1 BEGIN
 DELETE FROM court_replay_state;
 DELETE FROM court_replay_context;
 END;`);
}
// Caller must include this in the SAME transaction as the public event, live
// state and idempotent outcome. No await, model call, clock or random generation.
export function appendPrivateState(sql:SqlStorage,state:CourtState,eventId:string){
 const context:Record<string,unknown>={},dynamic:Record<string,unknown>={...state};
 for(const key of contextKeys){if(key in state)context[key]=state[key];delete dynamic[key];}
 const body=canonical(context);
 sql.exec('INSERT OR IGNORE INTO court_replay_context(body) VALUES(?)',body);
 const contextId=sql.exec<{id:number}>('SELECT id FROM court_replay_context WHERE body=?',body).one().id;
 sql.exec('INSERT INTO court_replay_state VALUES(?,?,?,?)',state.version,eventId,contextId,canonical(dynamic));
}

/** Read-only reconstruction of a recorded server snapshot. Not an import or
 * live restore API, not a command re-execution verifier. Legacy gaps are null.
 */
export function reconstructPrivateState(sql:SqlStorage,version:number,expected:{sessionId:string;owner:string}):CourtState|null{
 if(!Number.isSafeInteger(version)||version<0)throw Error('Invalid replay version');
 const meta=sql.exec<{schema_version:number}>('SELECT schema_version FROM court_replay_meta WHERE id=1').one();
 if(meta.schema_version!==1)throw Error('Unsupported private journal schema');
 const row=sql.exec<{body:string;context_id:number;event_id:string}>('SELECT body,context_id,event_id FROM court_replay_state WHERE version=?',version).toArray()[0];
 if(!row)return null;
 const context=sql.exec<{body:string}>('SELECT body FROM court_replay_context WHERE id=?',row.context_id).toArray()[0];
 const event=sql.exec<{event_id:string}>('SELECT event_id FROM court_events WHERE version=?',version).toArray()[0];
 if(!context||!event||event.event_id!==row.event_id)throw Error('Private journal integrity failure');
 const fixed=JSON.parse(context.body),dynamic=JSON.parse(row.body);
 if(!fixed||!dynamic||Array.isArray(fixed)||Array.isArray(dynamic)||typeof fixed!=='object'||typeof dynamic!=='object'||
   Object.keys(fixed).some(key=>!contextKeys.includes(key as typeof contextKeys[number]))||
   Object.keys(dynamic).some(key=>contextKeys.includes(key as typeof contextKeys[number])||['__proto__','constructor','prototype'].includes(key))||
   dynamic.version!==version||typeof fixed.id!=='string'||typeof fixed.owner!=='string')throw Error('Private journal integrity failure');
 const state=parsePrivateCourtState({...fixed,...dynamic},expected);
 if(!state)throw Error('Private journal integrity failure');
 return state;
}
