import {canonical,parseCourtWire} from '../court/protocol.js';
import {newEducationFlow,parseEducationFlow,transitionEducationFlow,educationFlowView,type EducationAction} from './court-education-flow.ts';
import {scoreEducationTest,parseEducationSurvey} from './court-education-instrument.ts';
type Storage=Pick<DurableObjectStorage,'sql'|'transactionSync'>;
type Progress='not_started'|'active'|'completed';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const failure=()=>new Error('Invalid education store');
export const EDUCATION_RETENTION_MS=30*86400000;
function command(body:string){
 try{
  if(typeof body!=='string'||new TextEncoder().encode(body).length>4096)return null;
  const v=parseCourtWire(body);
  const exact=(x:unknown,keys:string[]):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.sort().join(',');
  if(!exact(v,['requestId','expectedRevision','action'])||typeof v.requestId!=='string'||!uuid.test(v.requestId)||typeof v.expectedRevision!=='number'||!Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<0||v.expectedRevision>5)return null;
  const a=v.action;if(!a||typeof a!=='object'||!('kind' in a)||typeof a.kind!=='string')return null;
  if(['consent','case_completed'].includes(a.kind)){if(!exact(a,['kind']))return null;}
  else if(['pre','post','survey'].includes(a.kind)){
   if(!exact(a,['kind','submission'])||!('submission' in a))return null;
   if(a.kind==='survey'?!parseEducationSurvey(a.submission):!scoreEducationTest(a.submission,a.kind as 'pre'|'post'))return null;
  }else return null;
  return {requestId:v.requestId as string,expectedRevision:v.expectedRevision as number,action:a as EducationAction};
 }catch{return null;}
}
/** Internal adapter for ONE owned court session, not an unauthenticated RPC.
 * Host must authorize owner/CSRF, supply reviewed consent, and schedule retention.
 * No production constructor currently invokes this adapter.
 */
export class CourtEducationStore{
 private readonly storage:Storage;
 private readonly scope:string;
 private readonly clock:()=>number;
 constructor(storage:Storage,scope:string,clock:()=>number=Date.now){if(!uuid.test(scope))throw failure();this.storage=storage;this.scope=scope;this.clock=clock;}
 initialize(){this.storage.transactionSync(()=>{
  this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS education_meta(id INTEGER PRIMARY KEY CHECK(id=1),schema_version INTEGER NOT NULL,scope TEXT NOT NULL,withdrawn INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS education_state(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS education_receipts(request_id TEXT PRIMARY KEY,digest TEXT NOT NULL,revision INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS education_expiry(id INTEGER PRIMARY KEY CHECK(id=1),expires_at INTEGER NOT NULL);`);
  if(!this.storage.sql.exec('SELECT id FROM education_meta').toArray().length){
   if(this.storage.sql.exec('SELECT id FROM education_state').toArray().length||this.storage.sql.exec('SELECT request_id FROM education_receipts').toArray().length)throw failure();
   this.storage.sql.exec('INSERT INTO education_meta VALUES(1,1,?,0)',this.scope);
   this.storage.sql.exec('INSERT INTO education_state VALUES(1,?)',canonical(newEducationFlow()));
  }
  this.expire();this.read();
 });}
 private metadata(){
  const m=this.storage.sql.exec<{schema_version:number;scope:string;withdrawn:number}>('SELECT schema_version,scope,withdrawn FROM education_meta WHERE id=1').one();
  if(m.schema_version!==1||m.scope!==this.scope||![0,1].includes(m.withdrawn))throw failure();return m;
 }
 private read(){
  const meta=this.metadata();
  const rows=this.storage.sql.exec<{body:string}>('SELECT body FROM education_state WHERE id=1').toArray();
  if(meta.withdrawn){if(rows.length||this.storage.sql.exec('SELECT request_id FROM education_receipts').toArray().length)throw failure();return null;}
  if(rows.length!==1||rows[0].body.length>4096)throw failure();
  let s;try{s=parseEducationFlow(JSON.parse(rows[0].body));}catch{throw failure();}if(!s)throw failure();
  const expiry=this.expiry();if((s.phase==='off')!==(expiry===null))throw failure();return s;
 }
 private now(){const n=this.clock();if(!Number.isSafeInteger(n)||n<0||n>8e15)throw failure();return n;}
 private expiry(){
  const rows=this.storage.sql.exec<{expires_at:number}>('SELECT expires_at FROM education_expiry WHERE id=1').toArray();
  if(!rows.length)return null;const n=rows[0].expires_at;
  if(!Number.isSafeInteger(n)||n<EDUCATION_RETENTION_MS||n>8e15+EDUCATION_RETENTION_MS)throw failure();return n;
 }
 private erase(){
  this.storage.sql.exec('DELETE FROM education_state');this.storage.sql.exec('DELETE FROM education_receipts');this.storage.sql.exec('DELETE FROM education_expiry');
  this.storage.sql.exec('UPDATE education_meta SET withdrawn=1 WHERE id=1');
 }
 private expire(){this.metadata();const expiry=this.expiry();if(expiry!==null&&this.now()>=expiry)this.erase();}
 // Host must call from its alarm even when no player visits the session.
 prune(){return this.storage.transactionSync(()=>{this.expire();return {nextExpiry:this.expiry()};});}
 view(){return this.storage.transactionSync(()=>{this.expire();const s=this.read();return s?educationFlowView(s):{phase:'withdrawn' as const};});}
 async apply(body:string,progress:()=>Progress,enabled=false){
  const c=command(body);if(!c)return {code:'INVALID' as const};
  // Hash only a detached validated command. Never retain raw answers in receipts.
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(c))))).map(b=>b.toString(16).padStart(2,'0')).join('');
  return this.storage.transactionSync(()=>{
   this.expire();
   const state=this.read();if(!state)return {code:'WITHDRAWN' as const};
   if(!enabled)return {code:'DISABLED' as const};
   const old=this.storage.sql.exec<{digest:string;revision:number}>('SELECT digest,revision FROM education_receipts WHERE request_id=?',c.requestId).toArray()[0];
   if(old)return old.digest===digest?{code:'DUPLICATE' as const,appliedRevision:old.revision,view:educationFlowView(state)}:{code:'CONFLICT' as const};
   // Read authoritative case status after the asynchronous digest, inside commit.
   const next=transitionEducationFlow(state,c.action,c.expectedRevision,progress());
   if(!next)return {code:'CONFLICT' as const};
   if(c.action.kind==='consent')this.storage.sql.exec('INSERT INTO education_expiry VALUES(1,?)',this.now()+EDUCATION_RETENTION_MS);
   this.storage.sql.exec('UPDATE education_state SET body=? WHERE id=1',canonical(next));
   this.storage.sql.exec('INSERT INTO education_receipts VALUES(?,?,?)',c.requestId,digest,next.revision);
   return {code:'ACCEPTED' as const,appliedRevision:next.revision,view:educationFlowView(next)};
  });
 }
 // Authorized withdrawal also erases corrupted payloads; metadata still fences scope.
 withdraw(){return this.storage.transactionSync(()=>{
  this.metadata();this.erase();return {code:'WITHDRAWN' as const};
 });}
}
