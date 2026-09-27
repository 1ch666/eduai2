import {DurableObject} from 'cloudflare:workers';
import {initializeAdmissionStore,executeAdmission} from './admission-store';
import type {AdmissionPolicy,AdmissionRequest,AdmissionOutcome} from './admission';
import type {TokenUsage} from './contracts';

// Explicit opt-in policy. Not a promise of vendor free quota. Only stage
// dialogue currently adopts this binding; other routes are being migrated.
const policy:AdmissionPolicy={concurrency:2,queue:8,daily:100,userDaily:20,sessionDaily:12,
  queueMs:5000,leaseMs:60000,failureThreshold:3,cooldownMs:30000,quotaCooldownMs:60000,maxRecords:2048};
interface AdmissionEnvironment {AI_ADMISSION_ENABLED?:string}
export class AIAdmission extends DurableObject<AdmissionEnvironment> {
  constructor(ctx:DurableObjectState,env:AdmissionEnvironment){
    super(ctx,env);
    ctx.blockConcurrencyWhile(async()=>initializeAdmissionStore(ctx.storage));
  }
  admit(request:AdmissionRequest){
    return executeAdmission(this.ctx.storage,request,{type:'admit',request},Date.now(),policy,this.env.AI_ADMISSION_ENABLED==='true');
  }
  poll(request:AdmissionRequest){
    return executeAdmission(this.ctx.storage,request,{type:'poll',id:request.id},Date.now(),policy,this.env.AI_ADMISSION_ENABLED==='true');
  }
  cancel(request:AdmissionRequest){
    return executeAdmission(this.ctx.storage,request,{type:'cancel',id:request.id},Date.now(),policy,this.env.AI_ADMISSION_ENABLED==='true');
  }
  finish(request:AdmissionRequest,outcome:AdmissionOutcome,usage:TokenUsage){
    return executeAdmission(this.ctx.storage,request,{type:'finish',id:request.id,outcome,usage},Date.now(),policy,this.env.AI_ADMISSION_ENABLED==='true');
  }
}
