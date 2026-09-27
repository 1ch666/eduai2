import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseSnapshot,parseEvent,parseMutation,MAX_PROTOCOL_BYTES} from '../court/protocol.js';
import {CourtClientState} from '../court/client-state.js';
const sessionId='10000000-0000-4000-8000-000000000000';
const fixture=(version=0)=>({apiVersion:1,requestId:crypto.randomUUID(),caseId:'sale',sessionId,stateVersion:version,eventId:crypto.randomUUID(),eventSequence:version,timestamp:'2026-09-26T00:00:00.000Z',state:{title:'虛構測試',procedure:'civil',roleId:'judge',stageId:'opening',stageLabel:'開庭',completed:false,allowedActions:[{actionId:'acknowledge',label:'確認',category:'procedure',enabled:true,reasonDisabled:'',requiredTarget:'none'}],npcs:[],evidence:[],feedback:''}});
const raw=JSON.stringify;
test('shared raw wire negatives reject ambiguous fields and numeric/Unicode forms',async()=>{
 const base=await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8');
 const {edits}=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/wire-invalid.json',import.meta.url),'utf8'));
 for(const e of edits){assert.ok(base.includes(e.find),e.name);assert.equal(parseSnapshot(base.replace(e.find,e.replace)),null,e.name);}
 assert.equal(parseSnapshot(base+'{}'),null);
 assert.equal(parseSnapshot('['.repeat(10000)),null);
 assert.ok(parseSnapshot(base.replace('虛構契約測試','\\ud83d\\udcd6')));
});
test('Unity Editor and browser share the same nested public fixture',async()=>{
 const s=parseSnapshot(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
 assert.ok(s);assert.equal(s.state.evidence[0].metadata[0].value,'測試資料');
 for(const kind of ['image','document','chat','timeline','audioTranscript','objectPhoto','mapDiagram','syntheticRecord','cctvStill']){
  s.state.evidence[0].type=kind;assert.ok(parseSnapshot(raw(s)));
 }
});
const eventOf=s=>{const {state,...envelope}=s;return {...envelope,kind:'stage_changed',speaker:'法官',roleId:'judge',stageId:state.stageId,text:'確認程序',evidenceIds:[],citationIds:[],snapshot:s};};
test('strict DTO rejects unknown fields, missing fields, unsafe values and oversized UTF8',()=>{
 const good=fixture();assert.ok(parseSnapshot(raw(good)));
 const cases=[s=>s.apiVersion=2,s=>s.sessionId='token',s=>s.stateVersion=-1,s=>s.stateVersion=1.5,s=>s.timestamp='2026-02-30T00:00:00.000Z',s=>s.state.secret='hidden',s=>s.state.npcs.push({prompt:'private'}),s=>s.state.allowedActions.push(s.state.allowedActions[0]),s=>s.state.allowedActions[0].enabled=false,s=>delete s.state.feedback,s=>s.state.evidence.push({evidenceId:'hidden'}),s=>{s.state.procedure='juvenile';s.state.roleId='observer';}];
 for(const edit of cases){const value=structuredClone(good);edit(value);assert.equal(parseSnapshot(raw(value)),null);}
 assert.equal(parseSnapshot('{'),null);assert.equal(parseSnapshot('中'.repeat(MAX_PROTOCOL_BYTES/2)),null);
});
test('store rejects stale, duplicate/conflicting replies and different sessions',()=>{
 const store=new CourtClientState(),g=store.bind(sessionId,'sale'),a=fixture(2);
 assert.equal(store.acceptSnapshot(raw(a),g),'accepted');
 assert.equal(store.acceptSnapshot(raw({...a,requestId:crypto.randomUUID()}),g),'duplicate');
 assert.equal(store.acceptSnapshot(raw(fixture(1)),g),'stale');
 assert.equal(store.acceptSnapshot(raw(fixture(2)),g),'conflict');
 assert.equal(store.acceptSnapshot(raw({...fixture(3),caseId:'theft'}),g),'wrong-session');
 assert.equal(store.acceptSnapshot(raw({...fixture(3),eventId:a.eventId}),g),'conflict');
 const copy=store.snapshot;copy.state.title='tampered';assert.equal(store.snapshot.state.title,'虛構測試');
 assert.equal(store.acceptSnapshot(raw(fixture(8)),g),'accepted');
});
test('logout and rebind invalidate in-flight replies even to the same session',()=>{
 const store=new CourtClientState(),g=store.bind(sessionId,'sale');store.acceptSnapshot(raw(fixture()),g);store.clear();
 assert.equal(store.snapshot,null);assert.equal(store.acceptSnapshot(raw(fixture(1)),g),'obsolete-context');
 store.bind(sessionId,'sale');assert.equal(store.acceptSnapshot(raw(fixture(2)),g),'obsolete-context');
});
test('events require consistent identity, visible evidence references and contiguous sequence',()=>{
 const store=new CourtClientState(),g=store.bind(sessionId,'sale');const a=fixture(),b=fixture(1),e=eventOf(b);
 assert.ok(parseEvent(raw(e)));assert.equal(store.acceptEvent(raw(e),g),'needs-snapshot');
 store.acceptSnapshot(raw(a),g);assert.equal(store.acceptEvent(raw(eventOf(fixture(2))),g),'gap');
 assert.equal(store.snapshot.stateVersion,0);assert.equal(store.acceptEvent(raw(e),g),'accepted');
 assert.equal(store.acceptEvent(raw(e),g),'duplicate');
 assert.equal(parseEvent(raw({...e,eventId:crypto.randomUUID()})),null);
 assert.equal(parseEvent(raw({...e,evidenceIds:['hidden']})),null);
 const replay=new CourtClientState(),rg=replay.bind(sessionId,'sale');replay.acceptSnapshot(raw(a),rg);
 assert.equal(store.snapshot.stateVersion,1);assert.equal(replay.snapshot.stateVersion,0);
});
test('mutations require stable idempotency and expected version, never scores',()=>{
 const m={apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId,caseId:'sale',expectedStateVersion:0,actionId:'acknowledge',targetId:'',text:''};
 assert.ok(parseMutation(raw(m)));assert.equal(parseMutation(raw({...m,score:100})),null);
 assert.equal(parseMutation(raw({...m,idempotencyKey:''})),null);assert.equal(parseMutation(raw({...m,expectedStateVersion:-1})),null);
});
