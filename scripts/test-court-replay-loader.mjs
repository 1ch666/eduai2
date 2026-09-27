import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CourtReplayLoader} from '../court/replay-loader.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
function event(n){const snapshot={...structuredClone(fixture),stateVersion:n,eventSequence:n,eventId:crypto.randomUUID()};const {state,...envelope}=snapshot;return {...envelope,kind:n?'statement':'session_started',speaker:'法官',roleId:'judge',stageId:state.stageId,text:'紀錄',evidenceIds:[],citationIds:[],snapshot};}
function setup(fetchImpl,timeoutMs=1000){const l=new CourtReplayLoader({origin:'https://court.test',fetchImpl,timeoutMs});l.bind(fixture.sessionId,fixture.caseId);return l;}
test('authenticated GET pages populate separate replay without mutations',async()=>{
 const events=[event(0),event(1)];let calls=0;
 const l=setup(async(url,o)=>{assert.equal(o.method,'GET');assert.equal(o.credentials,'same-origin');assert.equal(o.redirect,'error');assert.equal(o.body,undefined);assert.equal(new URL(url).searchParams.get('after'),calls?'0':'-1');return Response.json({events:[events[calls++]],nextAfter:calls-1,currentVersion:1});});
 assert.equal(await l.next(),'more');assert.equal(l.caughtUp,false);assert.equal(await l.next(),'caught-up');assert.equal(l.replay.length,2);l.replay.step();assert.equal(calls,2);
});
test('invalid page cursor and duplicate JSON fields cannot append history',async()=>{
 const e=event(0);
 for(const raw of [JSON.stringify({events:[e],nextAfter:9,currentVersion:9}),JSON.stringify({events:[e],nextAfter:0,currentVersion:0}).replace('"currentVersion":0','"currentVersion":0,"currentVersion":1')]){
  const l=setup(async()=>new Response(raw));assert.equal(await l.next(),'malformed');assert.equal(l.replay.length,0);
 }
});
test('logout cancels uncooperative fetch and discards late history',async()=>{
 let resolve;const l=setup(()=>new Promise(r=>resolve=r));const pending=l.next();assert.equal(await l.next(),'pending');l.clear();
 assert.equal(await pending,'obsolete-context');resolve(Response.json({events:[event(0)],nextAfter:0,currentVersion:0}));assert.equal(l.replay.length,0);
});
test('deadline, oversize and auth failures are bounded without automatic retries',async()=>{
 for(const [fetch,status] of [[()=>new Promise(()=>{}),'timeout'],[async()=>new Response(new Uint8Array(262145)),'oversized'],[async()=>new Response('',{status:401}),'login-required'],[async()=>new Response('',{status:429}),'rate-limited']]){
  let calls=0;const l=setup((...a)=>{calls++;return fetch(...a);},10);assert.equal(await l.next(),status);assert.equal(calls,1);assert.equal(l.replay.length,0);
 }
});
