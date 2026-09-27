import type {AdmissionState,AdmissionRecord,AdmissionPhase,AdmissionOutcome} from './admission';

const fields=['schemaVersion','clock','failures','openUntil','circuitVersion','records'];
const rowFields=['id','fingerprint','userKey','sessionKey','day','created','deadline','phase','circuitVersion','outcome','usage'];
const phases=['queued','running','succeeded','failed','cancelled','unknown'];
const integer=(n:unknown,max=Number.MAX_SAFE_INTEGER):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=max;
const key=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9:_-]{1,128}$/.test(v);
function object(v:unknown,keys:readonly string[]):Record<string,unknown>|null {
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  const proto=Object.getPrototypeOf(v);
  if(proto!==Object.prototype&&proto!==null)return null;
  const names=Reflect.ownKeys(v);
  if(names.length!==keys.length)return null;
  const result:Record<string,unknown>=Object.create(null);
  for(const k of keys){
    const d=Object.getOwnPropertyDescriptor(v,k);
    if(!d||!('value' in d)||!d.enumerable)return null;
    result[k]=d.value;
  }
  return result;
}

/** Restore validator, NOT a repair routine. null must stop admission, never
 * initialize an empty budget over an existing corrupt/unknown-version ledger.
 * JSON byte limits must be enforced by the storage/import host before parsing.
 * Additional relational checks supplement the machine-readable shape schema.
 */
export function parseAdmissionState(value:unknown):AdmissionState|null {
  const s=object(value,fields);
  if(!s||s.schemaVersion!==1||!integer(s.clock,8e15)||!integer(s.failures,100)||
    !integer(s.openUntil,8e15+86400000)||!integer(s.circuitVersion)||
    s.openUntil>s.clock+86400000||s.failures===0&&s.openUntil!==0)return null;
  const rows=s.records;
  if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||rows.length>100000||
    Reflect.ownKeys(rows).length!==rows.length+1)return null;
  const result:AdmissionRecord[]=[],ids=new Set<string>();let previousCreated=0,queued=0,occupied=0;
  for(let i=0;i<rows.length;i++){
    const descriptor=Object.getOwnPropertyDescriptor(rows,String(i));
    if(!descriptor||!('value' in descriptor))return null;
    const r=object(descriptor.value,rowFields);
    if(!r||!key(r.id)||!key(r.fingerprint)||!key(r.userKey)||!key(r.sessionKey)||ids.has(r.id)||
      !integer(r.created,s.clock)||r.created<previousCreated||!integer(r.day)||r.day!==Math.floor(r.created/86400000)||
      !integer(r.deadline,8e15+60000)||r.deadline<=r.created||r.deadline>r.created+120000||r.deadline>s.clock+60000||
      !integer(r.circuitVersion,s.circuitVersion)||typeof r.phase!=='string'||!phases.includes(r.phase))return null;
    const phase=r.phase as AdmissionPhase;
    let usage:AdmissionRecord['usage']=null,outcome:AdmissionOutcome|null=null;
    if(phase==='succeeded'||phase==='failed'){
      if(phase==='succeeded'?r.outcome!=='success':r.outcome!=='failure'&&r.outcome!=='quota')return null;
      const u=object(r.usage,['inputTokens','outputTokens']);
      if(!u||u.inputTokens!==null&&!integer(u.inputTokens)||u.outputTokens!==null&&!integer(u.outputTokens))return null;
      usage={inputTokens:u.inputTokens as number|null,outputTokens:u.outputTokens as number|null};
      outcome=r.outcome as AdmissionOutcome;
    }else if(r.outcome!==null||r.usage!==null)return null;
    if(phase==='queued'){
      if(r.day!==Math.floor(s.clock/86400000)||r.deadline<=s.clock||++queued>1000)return null;
    }
    if(phase==='running'&&r.deadline<=s.clock)return null;
    if((phase==='running'||phase==='unknown'&&r.deadline>s.clock)&&++occupied>100)return null;
    ids.add(r.id);previousCreated=r.created;
    result.push({id:r.id,fingerprint:r.fingerprint,userKey:r.userKey,sessionKey:r.sessionKey,day:r.day,
      created:r.created,deadline:r.deadline,phase,circuitVersion:r.circuitVersion,outcome,usage});
  }
  return {schemaVersion:1,clock:s.clock,failures:s.failures,openUntil:s.openUntil,circuitVersion:s.circuitVersion,records:result};
}
