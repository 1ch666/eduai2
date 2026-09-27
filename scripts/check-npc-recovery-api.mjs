// Real local workerd + production browser transport; never target production.
// Creates disposable local accounts/sessions and leaves them for inspection.
import assert from 'node:assert/strict';
import {CourtTransport} from '../court/transport.js';
import {createPendingJournal} from '../court/pending-journal.js';
import {askNpcThroughTransport} from '../court/npc-action.js';
import {parseEvent} from '../court/protocol.js';

const base=process.argv[2],url=new URL(base);
assert.ok(url.origin===base&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname),'Explicit loopback HTTP origin required');
async function call(path,body,auth={}){
 const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(20000),
  headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},
  body:body?JSON.stringify(body):undefined});
 const data=await response.json();
 return {status:response.status,data,cookie:response.headers.getSetCookie().find(v=>v.startsWith('civic_session='))?.split(';')[0],csrf:data.csrfToken};
}
const capabilities=await call('/api/capabilities');
assert.equal(capabilities.status,200);assert.equal(capabilities.data.npcAi,false,'Run local Worker with COURT_AI_ENABLED=false; no model calls allowed');
const auth=await call('/api/auth/register',{username:'recover_'+crypto.randomUUID().slice(0,8),password:'disposable-local-recovery-2026',displayName:'本機斷線恢復測試'});
assert.equal(auth.status,201);assert.ok(auth.cookie&&auth.csrf&&auth.data.user.id);
const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};

for(const fault of ['network','malformed','timeout']){
 const created=await call('/api/court/sessions',config,auth);assert.equal(created.status,201);
 const id=created.data.view.id,values=new Map();let posts=0,committed,offline=false;
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const journalFactory=createPendingJournal({getStorage:()=>storage,getOwner:()=>auth.data.user.id});
 const fetchImpl=async(target,options)=>{
  assert.equal(new URL(target).origin,base);
  if(offline)throw new TypeError('Simulated offline outcome lookup');
  const response=await fetch(target,{...options,headers:{...options.headers,Origin:base,Cookie:auth.cookie}});
  if(options.method!=='POST')return response;
  posts++;assert.equal(response.status,200);
  committed=await response.json();assert.ok(parseEvent(JSON.stringify(committed)));assert.equal(committed.kind,'npc_utterance');
  // Fault is injected AFTER the actual server has committed. Do not fabricate
  // a successful event: recovery must obtain it from workerd's durable record.
  if(fault==='network')throw new TypeError('Simulated lost POST response');
  if(fault==='malformed')return new Response('{"truncated":', {headers:{'Content-Type':'application/json'}});
  return new Promise((resolve,reject)=>{
   if(options.signal.aborted){reject(new Error('aborted'));return;}
   options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  });
 };
 const make=()=>{const t=new CourtTransport({origin:base,csrf:()=>auth.csrf,fetchImpl,journalFactory,timeoutMs:3000});t.bind(id,'sale');return t;};
 const first=make();assert.equal(await first.refresh(),'accepted');
 const result=await askNpcThroughTransport(first,'Witness','你親眼看見什麼？');
 assert.equal(result,fault);assert.equal(posts,1);assert.equal(committed.stateVersion,1);
 const requestId=first.pending.requestId;assert.equal(requestId,committed.requestId);
 assert.deepEqual([...values.values()],[requestId]);
 assert.equal(await askNpcThroughTransport(first,'Witness','再問一次'),'pending');assert.equal(posts,1);
 first.clear();

 // Recreate only the client, as after reload. Journal is deliberately not a
 // browser API mock of auth: it retains ONLY the opaque request identifier.
 const restored=make();assert.equal(restored.pending.requestId,requestId);
 assert.equal(await restored.retry(),'retry-exhausted');assert.equal(posts,1);
 offline=true;assert.equal(await restored.recoverPending(),'network');assert.ok(restored.pending);assert.equal(restored.canAct,false);
 offline=false;assert.equal(await restored.recoverPending(),'accepted');
 assert.equal(restored.snapshot.stateVersion,1);assert.equal(restored.pending,null);assert.equal(restored.canAct,true);assert.equal(values.size,0);
 assert.equal(await restored.recoverPending(),'no-pending');assert.equal(posts,1);
 const events=await call('/api/court/sessions/'+id+'/events',undefined,auth);assert.equal(events.status,200);
 assert.equal(events.data.events.length,2);assert.equal(events.data.events.filter(e=>e.requestId===requestId).length,1);
 const history=await call('/api/court/sessions/'+id,undefined,auth);assert.equal(history.status,200);
 assert.equal(history.data.view.npcHistory.filter(e=>e.requestId===requestId).length,1);
 assert.equal(restored.lastDialogue.text,committed.text);
 restored.clear();
 console.log(`${fault}: real commit → lost response → client recreation → offline lookup → GET recovery; one POST, one NPC history, one event.`);
}
console.log('Local NPC recovery integration passed. Not a browser reload, physical disconnect, or live AI-provider test.');
