const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const record=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=(v,n)=>typeof v==='string'&&v.length<=n;
const list=(v,n,check)=>Array.isArray(v)&&v.length===n&&v.every(check);
const score=v=>record(v,['score','total'])&&v.total===3&&Number.isInteger(v.score)&&v.score>=0&&v.score<=3;
// Strict public projection only. Never import the server instrument/answer keys.
export function validEducationView(v){
 if(record(v,['phase']))return v.phase==='withdrawn';
 if(!record(v,['version','revision','phase','limitation','questions','survey','scale','results'])||v.version!=='court-reasoning-draft-1'||!text(v.limitation,500))return false;
 const revisions={off:0,pre:1,playing:2,post:3,survey:4,complete:5};
 if(!Object.hasOwn(revisions,v.phase)||v.revision!==revisions[v.phase])return false;
 const question=q=>record(q,['id','conceptId','text','choices'])&&text(q.id,80)&&text(q.conceptId,80)&&text(q.text,500)&&list(q.choices,3,s=>text(s,300));
 if(!list(v.questions,['pre','post'].includes(v.phase)?3:0,question)||new Set(v.questions.map(q=>q.id)).size!==v.questions.length)return false;
 const ids=['clarity','evidence','followup','usability'];
 if(!list(v.survey,v.phase==='survey'?4:0,q=>record(q,['id','text'])&&ids.includes(q.id)&&text(q.text,500))||new Set(v.survey.map(q=>q.id)).size!==v.survey.length)return false;
 if(v.phase==='survey'){
  if(!record(v.scale,['min','max','labels'])||v.scale.min!==1||v.scale.max!==5||!list(v.scale.labels,5,s=>text(s,80)))return false;
 }else if(v.scale!==null)return false;
 return ['survey','complete'].includes(v.phase)?record(v.results,['pre','post'])&&score(v.results.pre)&&score(v.results.post):v.results===null;
}
function dataView(data){
 if(record(data,['code'])&&['DISABLED','WITHDRAWN'].includes(data.code))return {phase:data.code==='DISABLED'?'disabled':'withdrawn'};
 if(record(data,['view'])&&validEducationView(data.view))return data.view;
 if(record(data,['code','appliedRevision','view'])&&['ACCEPTED','DUPLICATE'].includes(data.code)&&Number.isInteger(data.appliedRevision)&&data.appliedRevision>=1&&data.appliedRevision<=5&&validEducationView(data.view)&&data.view.revision>=data.appliedRevision)return data.view;
 return null;
}
export class CourtEducationClient{
 #origin;#fetch;#csrf;#timeout;#session='';#epoch=0;#controller=null;#view=null;#pending=null;
 constructor({origin,csrf,fetchImpl=globalThis.fetch,timeoutMs=15000}){
  if(new URL(origin).origin!==origin||!/^https?:/.test(origin)||typeof csrf!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('Invalid education client');
  this.#origin=origin;this.#csrf=csrf;this.#fetch=fetchImpl;this.#timeout=timeoutMs;
 }
 get view(){return this.#view?structuredClone(this.#view):null;}get pending(){return !!this.#pending;}get busy(){return !!this.#controller;}
 clear(){this.#epoch++;this.#controller?.abort();this.#controller=null;this.#session='';this.#view=null;this.#pending=null;}
 bind(id){if(!uuid(id))throw Error('Invalid session');this.clear();this.#session=id;}
 refresh(){return this.#request('GET');}
 withdraw(){return this.#request('DELETE');}
 submit(action,revision){
  if(this.busy||this.pending)return Promise.resolve('pending');
  if(!this.#view||this.#view.revision!==revision)return Promise.resolve('refresh-required');
  const body=JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:revision,action});
  if(new TextEncoder().encode(body).length>4096)return Promise.resolve('invalid');
  this.#pending={body,revision};return this.#request('POST',body);
 }
 retry(){return this.#pending?this.#request('POST',this.#pending.body):Promise.resolve('no-pending');}
 async #request(method,body){
  if(!this.#session)return 'no-context';if(this.busy)return 'pending';
  const epoch=this.#epoch,controller=new AbortController();this.#controller=controller;
  const timer=setTimeout(()=>controller.abort(),this.#timeout);
  const read=async()=>{
   const r=await this.#fetch(`${this.#origin}/api/v2/court/sessions/${this.#session}/education`,{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/json',...(method==='GET'?{}:{'X-CSRF-Token':this.#csrf()}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body}:{})});
   if(!r.ok){await r.body?.cancel();return {status:r.status};}
   if(!r.body)throw Error();const reader=r.body.getReader();let size=0,raw='';const decoder=new TextDecoder('utf-8',{fatal:true});
   const cancel=()=>{void reader.cancel().catch(()=>{});};controller.signal.addEventListener('abort',cancel,{once:true});if(controller.signal.aborted)cancel();
   try{while(true){const c=await reader.read();if(c.done)break;size+=c.value.byteLength;if(size>32768){await reader.cancel();throw Error();}raw+=decoder.decode(c.value,{stream:true});}raw+=decoder.decode();}
   finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock();}
   const p=JSON.parse(raw);
   if(!record(p,['ok','apiVersion','requestId','traceId','timestamp','errorCode','stateVersion','data'])||p.ok!==true||p.apiVersion!==2||!uuid(p.requestId)||!text(p.traceId,64)||!text(p.timestamp,40)||p.errorCode!==null||p.stateVersion!==null)throw Error();
   const view=dataView(p.data);if(!view)throw Error();return {view};
  };
  let onAbort;
  const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Error('cancelled'));controller.signal.addEventListener('abort',onAbort,{once:true});});
  try{
   const r=await Promise.race([read(),aborted]);if(epoch!==this.#epoch)return 'obsolete-context';
   if(r.status){if(r.status===401){this.clear();return 'login-required';}return ({403:'forbidden',404:'not-found',409:'conflict',410:'withdrawn',429:'rate-limited'}[r.status])||'unavailable';}
   if(this.#view?.phase==='withdrawn'&&r.view.phase!=='withdrawn')return 'stale';
   if(Number.isInteger(this.#view?.revision)&&Number.isInteger(r.view.revision)&&r.view.revision<this.#view.revision)return 'stale';
   this.#view=r.view;
   if(method!=='GET'||r.view.phase==='withdrawn'||(this.#pending&&r.view.revision>this.#pending.revision))this.#pending=null;
   return r.view.phase==='disabled'?'disabled':'accepted';
  }catch{return epoch!==this.#epoch?'obsolete-context':controller.signal.aborted?'timeout':'unavailable';}
  finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);if(this.#controller===controller)this.#controller=null;}
 }
}
