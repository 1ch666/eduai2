import {CourtEducationStore} from './court-education-store.ts';
type Storage=Pick<DurableObjectStorage,'sql'|'transaction'|'setAlarm'|'deleteAlarm'>;
/** Internal host adapter; not an authenticated API. Requires an exclusively
 * owned alarm. Do not mix this with another scheduler on the same DO.
 * The eventual host must authorize all calls and invoke alarm() on delivery.
 */
export class CourtEducationScheduler{
 private readonly store:CourtEducationStore;
 private readonly storage:Storage;
 constructor(storage:Storage,scope:string,clock:()=>number=Date.now){
  this.storage=storage;
  // Outer async transaction must cover both SQL and alarm; no nested transaction.
  this.store=new CourtEducationStore({sql:storage.sql,transactionSync:fn=>fn()},scope,clock);
 }
 private run<T>(operation:()=>T|Promise<T>){return this.storage.transaction(async()=>{
  const result=await operation();
  const {nextExpiry}=this.store.prune();
  if(nextExpiry===null)await this.storage.deleteAlarm();else await this.storage.setAlarm(nextExpiry);
  return result;
 });}
 // Explicit initialization only, never constructor-time scheduling before a
 // pending alarm's delivery. No collection is enabled by initialization.
 initialize(){return this.run(()=>{this.store.initialize();return this.store.view();});}
 view(){return this.run(()=>this.store.view());}
 apply(body:string,progress:()=> 'not_started'|'active'|'completed',enabled=false){return this.run(()=>this.store.apply(body,progress,enabled));}
 alarm(){return this.run(()=>this.store.prune());}
 withdraw(){return this.run(()=>this.store.withdraw());}
}
