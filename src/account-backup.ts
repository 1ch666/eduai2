/** Offline operator-side archive validation. Never exposed through public APIs.
 * Validation is not authorization, freshness or proof of a complete live export.
 */
export type AccountBackup = {
 schemaVersion:1; sessionPolicy:'reauthenticate';
 tables:{
  users:{id:string;username:string;display_name:string;password_hash:string;password_salt:string;password_iterations:number;created_at:string;last_login_at:string|null}[];
  recovery_codes:{user_id:string;code_hash:string}[];
  progress:{user_id:string;scope:string;payload:string;self_reported:1;updated_at:string}[];
  auth_limits:{key:string;window_start:number;attempt_count:number}[];
 };
};
export const MAX_ACCOUNT_BACKUP_BYTES=4*1024*1024;
const invalid=()=>new Error('Invalid account backup');
const encoder=new TextEncoder();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hex=/^[0-9a-f]{64}$/;
function exact(x:unknown,keys:string[]):x is Record<string,unknown>{
 return !!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
}
function str(x:unknown,min:number,max:number):x is string{return typeof x==='string'&&x.length>=min&&x.length<=max;}
function date(x:unknown):x is string{return typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;}
function integer(x:unknown,min:number,max=Number.MAX_SAFE_INTEGER):x is number{return typeof x==='number'&&Number.isSafeInteger(x)&&x>=min&&x<=max;}
function unique(seen:Set<string>,key:string){if(seen.has(key))throw invalid();seen.add(key);}

/** Accept bytes, not live JS objects/accessors. Returns a detached parsed value.
 * All failures are fixed messages; credentials/private payload are never logged.
 */
export function parseAccountBackup(bytes:Uint8Array):AccountBackup{
 try{
  if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>MAX_ACCOUNT_BACKUP_BYTES)throw invalid();
  const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const x:unknown=JSON.parse(raw);
  // Require JSON.stringify framing: no duplicate keys or ambiguous encodings.
  if(JSON.stringify(x)!==raw)throw invalid();
  if(!exact(x,['schemaVersion','sessionPolicy','tables'])||x.schemaVersion!==1||x.sessionPolicy!=='reauthenticate'||
   !exact(x.tables,['users','recovery_codes','progress','auth_limits']))throw invalid();
  const t=x.tables;
  for(const [name,max] of [['users',10000],['recovery_codes',10000],['progress',40000],['auth_limits',100000]] as const)
   if(!Array.isArray(t[name])||t[name].length>max)throw invalid();
  const users=new Set<string>(),names=new Set<string>();
  for(const r of t.users as unknown[]){
   if(!exact(r,['id','username','display_name','password_hash','password_salt','password_iterations','created_at','last_login_at'])||
    !str(r.id,36,36)||!uuid.test(r.id)||!str(r.username,3,24)||!/^[a-z0-9_]+$/.test(r.username)||
    !str(r.display_name,1,24)||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(r.display_name)||
    !str(r.password_hash,64,64)||!hex.test(r.password_hash)||!str(r.password_salt,32,32)||!/^[0-9a-f]{32}$/.test(r.password_salt)||
    !integer(r.password_iterations,20000,400000)||!date(r.created_at)||
    (r.last_login_at!==null&&(!date(r.last_login_at)||r.last_login_at<r.created_at)))throw invalid();
   unique(users,r.id);unique(names,r.username);
  }
  const recovery=new Set<string>(),progress=new Set<string>(),limits=new Set<string>();
  for(const r of t.recovery_codes as unknown[]){
   if(!exact(r,['user_id','code_hash'])||typeof r.user_id!=='string'||!users.has(r.user_id)||!str(r.code_hash,64,64)||!hex.test(r.code_hash))throw invalid();
   unique(recovery,r.user_id);
  }
  // Legacy accounts without a first recovery code are valid; do not invent one.
  for(const r of t.progress as unknown[]){
   if(!exact(r,['user_id','scope','payload','self_reported','updated_at'])||typeof r.user_id!=='string'||!users.has(r.user_id)||
    typeof r.scope!=='string'||!['civics','daily','court','game'].includes(r.scope)||r.self_reported!==1||
    !str(r.payload,1,8192)||encoder.encode(r.payload).byteLength>8192||!date(r.updated_at))throw invalid();
   JSON.parse(r.payload);unique(progress,r.user_id+'\0'+r.scope);
  }
  for(const r of t.auth_limits as unknown[]){
   if(!exact(r,['key','window_start','attempt_count'])||!str(r.key,1,512)||!integer(r.window_start,0)||
    r.window_start%300000!==0||!integer(r.attempt_count,1))throw invalid();
   unique(limits,r.key);
  }
  return x as AccountBackup;
 }catch{throw invalid();}
}
