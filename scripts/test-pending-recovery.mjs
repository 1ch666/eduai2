import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPendingJournal} from '../court/pending-journal.js';
import {CourtTransport} from '../court/transport.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
function storage(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
function journal(db,owner='account-a'){return createPendingJournal({getStorage:()=>db,getOwner:()=>owner});}
function event(body){const m=JSON.parse(body),s={...structuredClone(fixture),requestId:m.requestId,stateVersion:1,eventSequence:1,eventId:crypto.randomUUID()};const {state,...envelope}=s;return {...envelope,kind:'stage_changed',speaker:'法官',roleId:'judge',stageId:state.stageId,text:'確認',evidenceIds:[],citationIds:[],snapshot:s};}
function transport(db,fetchImpl,extra={}){const t=new CourtTransport({origin:'https://court.test',csrf:()=> 'not-persisted-csrf',fetchImpl,journalFactory:journal(db),...extra});t.bind(fixture.sessionId,fixture.caseId);return t;}
function snapshot(url){return Response.json({...structuredClone(fixture),requestId:new URL(url).searchParams.get('requestId')});}

test('journal isolates owners and retains only opaque request IDs',()=>{
 const db=storage(),scope={sessionId:fixture.sessionId,caseId:fixture.caseId},a=journal(db)(scope),b=journal(db,'account-b')(scope),id=crypto.randomUUID();
 a.save(id);assert.equal(a.read(),id);assert.equal(b.read(),null);assert.deepEqual([...db.values.values()],[id]);
 assert.throws(()=>a.save('private statement'));assert.throws(()=>a.remove(crypto.randomUUID()));assert.equal(a.read(),id);
 a.remove(id);assert.equal(a.read(),null);
});
test('reload recovers validated outcome with GET only and no original text retained',async()=>{
 const db=storage();let saved,posts=0;
 const fetchImpl=async(url,o)=>{if(url.includes('/requests/'))return Response.json(saved);if(o.method==='GET')return snapshot(url);posts++;saved=event(o.body);return new Response('',{status:500});};
 const first=transport(db,fetchImpl);await first.refresh();assert.equal(await first.act('acknowledge',{text:'private statement'}),'unavailable');
 const id=first.pending.requestId;first.clear();assert.deepEqual([...db.values.values()],[id]);
 const restored=transport(db,fetchImpl);assert.equal(restored.pending.requestId,id);assert.equal(await restored.retry(),'retry-exhausted');
 assert.equal(await restored.recoverPending(),'accepted');assert.equal(restored.snapshot.stateVersion,1);assert.equal(restored.pending,null);assert.equal(restored.canAct,true);assert.equal(posts,1);assert.equal(db.values.size,0);
});
test('failed marker removal stays blocked until a verified cleanup succeeds',async()=>{
 const db=storage(),remove=db.removeItem;let fail=true,saved;
 db.removeItem=k=>{if(fail)return;remove(k);};
 const t=transport(db,async(url,o)=>{if(url.includes('/requests/'))return Response.json(saved);if(o.method==='GET')return snapshot(url);saved=event(o.body);return Response.json(saved);});
 await t.refresh();assert.equal(await t.act('acknowledge'),'persistence-unavailable');assert.equal(t.recoveryBlocked,true);assert.equal(t.canAct,false);assert.ok(t.pending);
 fail=false;assert.equal(await t.recoverPending(),'duplicate');assert.equal(t.recoveryBlocked,false);assert.equal(t.canAct,true);assert.equal(t.pending,null);
});
test('storage denied blocks POST instead of submitting an untracked request',async()=>{
 const db=storage();let posts=0;db.setItem=()=>{throw new Error('denied');};
 const t=transport(db,async(url,o)=>{if(o.method==='GET')return snapshot(url);posts++;return Response.json(event(o.body));});
 await t.refresh();assert.equal(await t.act('acknowledge'),'persistence-unavailable');assert.equal(posts,0);assert.equal(t.canAct,false);
});
test('an ambiguous first attempt remains pending after a later rejection',async()=>{
 const db=storage();let time=0,posts=0;
 const t=transport(db,async(url,o)=>o.method==='GET'?snapshot(url):new Response('',{status:++posts===1?500:409}),{now:()=>time});
 await t.refresh();await t.act('acknowledge');const id=t.pending.requestId;time=2000;
 assert.equal(await t.retry(),'conflict');assert.equal(t.pending.requestId,id);assert.deepEqual([...db.values.values()],[id]);assert.equal(t.canAct,false);
});
test('missing outcome after reload never unlocks new mutations',async()=>{
 const db=storage(),id=crypto.randomUUID();journal(db)({sessionId:fixture.sessionId,caseId:fixture.caseId}).save(id);
 const t=transport(db,async()=>new Response('',{status:404}));
 assert.equal(await t.recoverPending(),'outcome-unknown');assert.equal(await t.act('acknowledge'),'pending');assert.equal(t.pending.requestId,id);assert.equal(t.canAct,false);
});
