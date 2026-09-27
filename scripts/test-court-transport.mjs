import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CourtTransport} from '../court/transport.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
const json=Response.json;
function snapshot(url,v=0){return {...structuredClone(fixture),requestId:new URL(url).searchParams.get('requestId'),stateVersion:v,eventSequence:v};}
function event(body){const m=JSON.parse(body),s={...structuredClone(fixture),requestId:m.requestId,stateVersion:1,eventSequence:1,eventId:crypto.randomUUID()};const {state,...envelope}=s;return {...envelope,kind:'stage_changed',speaker:'法官',roleId:'judge',stageId:state.stageId,text:'確認',evidenceIds:[],citationIds:[],snapshot:s};}
function setup(fetchImpl,more={}){const t=new CourtTransport({origin:'https://court.test',csrf:()=> 'test-csrf',fetchImpl,...more});t.bind(fixture.sessionId,fixture.caseId);return t;}
test('same-origin authenticated transport applies only correlated replies',async()=>{
 const t=setup(async(url,o)=>{assert.equal(o.credentials,'same-origin');assert.equal(o.redirect,'error');if(o.method==='GET')return json(snapshot(url));assert.equal(o.headers['X-CSRF-Token'],'test-csrf');return json(event(o.body));});
 assert.equal(await t.refresh(),'accepted');assert.equal(t.canAct,true);assert.equal(await t.act('acknowledge'),'accepted');assert.equal(t.snapshot.stateVersion,1);assert.equal(t.pending,null);
});
test('wrong request identity cannot replace snapshot',async()=>{
 const t=setup(async()=>json(fixture));assert.equal(await t.refresh(),'malformed');assert.equal(t.snapshot,null);assert.equal(t.canAct,false);
});
test('timeout blocks fresh actions; explicit retries keep exact bytes and IDs',async()=>{
 const bodies=[];let time=0;
 const t=setup(async(url,o)=>{if(o.method==='GET')return json(snapshot(url));bodies.push(o.body);if(bodies.length===1)return new Promise(()=>{});return json(event(o.body));},{timeoutMs:15,now:()=>time});
 await t.refresh();assert.equal(await t.act('acknowledge'),'timeout');assert.equal(t.snapshot.stateVersion,0);assert.equal(await t.act('acknowledge'),'pending');
 time=2000;assert.equal(await t.retry(),'accepted');assert.equal(bodies[0],bodies[1]);assert.equal(t.pending,null);
});
test('logout cancels in-flight reply without repopulating private state',async()=>{
 let resolve;const t=setup(()=>new Promise(r=>resolve=r));const pending=t.refresh();t.clear();resolve(json(fixture));assert.equal(await pending,'obsolete-context');assert.equal(t.snapshot,null);
});
test('HTTP failures retain state; 401 clears, 409 requires refresh, 429 honors bounded delay',async()=>{
 for(const [status,label] of [[401,'login-required'],[403,'forbidden'],[409,'conflict'],[429,'rate-limited'],[500,'unavailable']]){
  let time=0;const t=setup(async(url,o)=>o.method==='GET'?json(snapshot(url)):new Response('',{status,headers:{'Retry-After':'99999'}}),{now:()=>time});
  await t.refresh();assert.equal(await t.act('acknowledge'),label);assert.equal(t.canAct,false);assert.equal(t.snapshot?.stateVersion,status===401?undefined:0);
  if(status===429){assert.equal(await t.retry(),'rate-limited');time=120001;assert.equal(await t.retry(),'rate-limited');assert.equal(t.pending.attempts,2);}
 }
});
test('streaming size and deadline limits include the response body',async()=>{
 for(const response of [()=>new Response(new Uint8Array(262145)),()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));}}))]){
  const t=setup(async()=>response(),{timeoutMs:15});assert.ok(['malformed','timeout'].includes(await t.refresh()));assert.equal(t.snapshot,null);
 }
});
test('three failed attempts never generate a fourth request or new action',async()=>{
 let time=0,calls=0;const t=setup(async(url,o)=>{if(o.method==='GET')return json(snapshot(url));calls++;return new Response('',{status:500});},{now:()=>time});
 await t.refresh();await t.act('acknowledge');time+=2000;await t.retry();time+=2000;await t.retry();time+=2000;assert.equal(await t.retry(),'retry-exhausted');assert.equal(calls,3);assert.equal(await t.act('acknowledge'),'pending');
});
test('indeterminate mutation recovers from recorded outcome without resending',async()=>{
 let saved,time=0,posts=0,missing=true;
 const t=setup(async(url,o)=>{
  if(url.includes('/requests/'))return missing?new Response('',{status:404}):json(saved);
  if(o.method==='GET')return json(snapshot(url));posts++;saved=event(o.body);return new Response('',{status:500});
 },{now:()=>time});
 await t.refresh();await t.act('acknowledge');assert.equal(await t.recoverPending(),'outcome-unknown');assert.ok(t.pending);
 missing=false;assert.equal(await t.recoverPending(),'accepted');assert.equal(posts,1);assert.equal(t.pending,null);assert.equal(t.snapshot.stateVersion,1);
});
test('logout settles even when an uncooperative fetch never resolves',async()=>{
 const t=setup(()=>new Promise(()=>{}),{timeoutMs:5000});const pending=t.refresh();t.clear();assert.equal(await pending,'obsolete-context');
});
test('timeout cancels body stream instead of leaving a read running',async()=>{
 let cancelled=false;const t=setup(async()=>new Response(new ReadableStream({cancel(){cancelled=true;}})),{timeoutMs:15});
 assert.equal(await t.refresh(),'timeout');assert.equal(cancelled,true);
});
