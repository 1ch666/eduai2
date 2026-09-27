import {LearningEventStore} from './learning-event-store';
import type {LearningEventPolicy} from './learning-events';

type Storage=Pick<DurableObjectStorage,'sql'|'transaction'|'setAlarm'|'deleteAlarm'>;

/** Internal per-scope SQLite host; not an authenticated RPC/API or a collector.
 * The enclosing DO must dedicate its single alarm to this scheduler. SQL state
 * and alarm changes commit together. Never expose now/policy/consent to clients.
 */
export class LearningEventScheduler {
 private readonly store:LearningEventStore;
 constructor(private readonly storage:Storage,policy:LearningEventPolicy){
  // Every call below owns an outer async SQLite transaction. Avoid nested
  // transactionSync: the alarm is asynchronous and must share that transaction.
  this.store=new LearningEventStore({sql:storage.sql,transactionSync:fn=>fn()},policy);
 }
 private async run(operation:()=>ReturnType<LearningEventStore['apply']>){
  return this.storage.transaction(async()=>{
   const result=operation();
   if(result.nextExpiry===null)await this.storage.deleteAlarm();
   else await this.storage.setAlarm(result.nextExpiry);
   return result;
  });
 }
 /** Explicit boot/recovery, not automatic constructor scheduling: calling it
  * from a constructor before a pending alarm can interfere with alarm delivery.
  */
 initialize(now:number){return this.run(()=>{this.store.initialize(now);return this.store.prune(now);});}
 apply(event:unknown,now:number,consent=false){return this.run(()=>this.store.apply(event,now,consent));}
 alarm(now:number){return this.run(()=>this.store.prune(now));}
 withdraw(){return this.run(()=>this.store.withdraw());}
}
