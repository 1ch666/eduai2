import {canonical} from '../court/protocol.js';
import {parseLearningEventState,reduceLearningEvents,LEARNING_RETENTION_MS,type LearningEventPolicy,type LearningEventState} from './learning-events';

type Storage=Pick<DurableObjectStorage,'sql'|'transactionSync'>;
const MAX_BYTES=1024*1024;
const failure=()=>new Error('Invalid learning event store');
type Meta={schema_version:number;anonymous_id:string;withdrawn:number};

/** Internal storage adapter, not a DO RPC or consent/authentication API.
 * Dedicated database per trusted anonymous scope. Initialization alone records
 * no events. Production must add reviewed consent and reliable alarm scheduling.
 */
export class LearningEventStore {
 private readonly policy:LearningEventPolicy;
 constructor(private readonly storage:Storage,policy:LearningEventPolicy){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(policy.anonymousId))throw failure();
  this.policy={anonymousId:policy.anonymousId,conceptIds:new Set(policy.conceptIds)};
 }
 initialize(now:number){
  if(!Number.isSafeInteger(now)||now<0||now>8e15)throw failure();
  this.storage.transactionSync(()=>{
   this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS learning_meta(id INTEGER PRIMARY KEY CHECK(id=1),schema_version INTEGER NOT NULL,anonymous_id TEXT NOT NULL,withdrawn INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS learning_state(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL);`);
   const rows=this.storage.sql.exec<Meta>('SELECT schema_version,anonymous_id,withdrawn FROM learning_meta WHERE id=1').toArray();
   if(!rows.length){
    if(this.storage.sql.exec('SELECT id FROM learning_state').toArray().length)throw failure();
    this.storage.sql.exec('INSERT INTO learning_meta VALUES(1,1,?,0)',this.policy.anonymousId);
    this.storage.sql.exec('INSERT INTO learning_state VALUES(1,?)',canonical({schemaVersion:1,clock:now,events:[]}));
   }
   this.read();
  });
 }
 private metadata():Meta{
  const m=this.storage.sql.exec<Meta>('SELECT schema_version,anonymous_id,withdrawn FROM learning_meta WHERE id=1').one();
  if(m.schema_version!==1||m.anonymous_id!==this.policy.anonymousId||![0,1].includes(m.withdrawn))throw failure();
  return m;
 }
 private read():LearningEventState|null{
  const m=this.metadata();
  const rows=this.storage.sql.exec<{body:string}>('SELECT body FROM learning_state WHERE id=1').toArray();
  if(m.withdrawn===1){if(rows.length)throw failure();return null;}
  if(rows.length!==1||typeof rows[0].body!=='string'||new TextEncoder().encode(rows[0].body).length>MAX_BYTES)throw failure();
  let parsed:unknown;try{parsed=JSON.parse(rows[0].body);}catch{throw failure();}
  const state=parseLearningEventState(parsed,this.policy);if(!state)throw failure();return state;
 }
 apply(event:unknown,now:number,consent=false){
  return this.storage.transactionSync(()=>{
   const state=this.read();if(!state)return {code:'WITHDRAWN' as const,nextExpiry:null};
   const result=reduceLearningEvents(state,event,now,this.policy,consent);
   if(!result.state)throw failure();
   const body=canonical(result.state);if(new TextEncoder().encode(body).length>MAX_BYTES)throw failure();
   if(body!==canonical(state))this.storage.sql.exec('UPDATE learning_state SET body=? WHERE id=1',body);
   const nextExpiry=result.state.events.length?Math.min(...result.state.events.map(e=>e.occurredAt+LEARNING_RETENTION_MS)):null;
   return {code:result.code,nextExpiry};
  });
 }
 // Maintenance remains allowed when collection is disabled. The host must call
 // this from its durable alarm; returning nextExpiry alone schedules nothing.
 prune(now:number){return this.apply(null,now,true);}
 withdraw(){
  return this.storage.transactionSync(()=>{
   // Authorized erasure must still work if the event body is corrupt. Validate
   // trusted scope/schema metadata, not the data being erased.
   this.metadata();
   this.storage.sql.exec('DELETE FROM learning_state');
   this.storage.sql.exec('UPDATE learning_meta SET withdrawn=1 WHERE id=1');
   return {code:'WITHDRAWN' as const,nextExpiry:null};
  });
 }
}
