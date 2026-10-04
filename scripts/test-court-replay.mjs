import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CourtReplay} from '../court/replay.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
function event(n,kind=n?'statement':'session_started'){
 const snapshot={...structuredClone(fixture),eventId:crypto.randomUUID(),stateVersion:n,eventSequence:n};
 const {state,...envelope}=snapshot;
 return {...envelope,kind,speaker:'證人',roleId:'witness',stageId:state.stageId,text:'紀錄 '+n,evidenceIds:[],citationIds:[],snapshot};
}
function setup(){const r=new CourtReplay();r.bind(fixture.sessionId,fixture.caseId);return r;}
test('play, pause, step and jump restore historical snapshots without sharing mutable state',()=>{
 const r=setup(),events=[event(0),event(1),event(2)];
 events[0].snapshot.state.evidence=[];
 assert.equal(r.append(events.map(JSON.stringify)),'accepted');assert.equal(r.index,0);
 assert.equal(r.current.snapshot.state.evidence.length,0);
 assert.equal(r.play(),true);assert.equal(r.tick(500),false);assert.equal(r.tick(500),true);assert.equal(r.index,1);
 r.pause();assert.equal(r.tick(2000),false);assert.equal(r.step(),true);assert.equal(r.play(),false);
 assert.equal(r.jump(events[0].eventId),true);assert.equal(r.current.snapshot.state.evidence.length,0);
 const copy=r.current;copy.snapshot.state.title='tampered';assert.notEqual(r.current.snapshot.state.title,'tampered');
 assert.equal(r.seek(100),false);assert.equal(r.index,0);assert.equal(r.step(-1),false);
});
test('pages are atomic; duplicate history is stable; gaps and conflicts stop playback',()=>{
 const r=setup(),a=event(0),b=event(1);r.append([JSON.stringify(a),JSON.stringify(b)]);r.play();
 assert.equal(r.append([JSON.stringify(event(2)),JSON.stringify(event(4))]),'gap');assert.equal(r.length,2);assert.equal(r.playing,false);
 assert.equal(r.append([JSON.stringify(a),JSON.stringify(b)]),'duplicate');
 assert.equal(r.append([JSON.stringify({...b,text:'changed'})]),'conflict');
 assert.equal(r.append([JSON.stringify({...event(2),owner:'private'})]),'malformed');assert.equal(r.length,2);
});
test('old-session checkpoint is explicit, and cross-session or recycled event IDs are rejected',()=>{
 const r=setup(),a=event(7,'checkpoint');assert.equal(r.append([JSON.stringify(a)]),'accepted');assert.equal(r.incompletePrefix,true);
 const b=event(8);b.sessionId=crypto.randomUUID();b.snapshot.sessionId=b.sessionId;
 assert.equal(r.append([JSON.stringify(b)]),'wrong-session');
 const c=event(8);c.eventId=a.eventId;c.snapshot.eventId=a.eventId;
 assert.equal(r.append([JSON.stringify(c)]),'conflict');
 r.clear();assert.equal(r.current,null);assert.equal(r.append([]),'no-context');
});
test('transcript filters never expose future records and do not interpret markup',()=>{
 const r=setup(),a=event(0),b=event(1);b.text='<script>不是執行碼</script>';b.roleId='judge';
 r.append([JSON.stringify(a),JSON.stringify(b)]);
 assert.equal(r.transcript({roleId:'judge'}).length,0);r.step();
 const results=r.transcript({roleId:'judge',query:'不是'});assert.equal(results.length,1);assert.equal(results[0].text,b.text);
 results[0].text='changed';assert.equal(r.transcript({kind:'statement'})[0].text,b.text);
 assert.equal(r.transcript({query:null}).length,0);
});
test('background elapsed time advances at most one visible event and cannot trigger network',()=>{
 const r=setup();r.append([event(0),event(1),event(2)].map(JSON.stringify));r.play();
 assert.equal(r.tick(Infinity),false);assert.equal(r.tick(-1),false);r.tick(60000);assert.equal(r.index,1);assert.equal(r.playing,true);
});

test('procedure labels use only the preceding public snapshot, preserving raw history and dialogue',()=>{
 const r=setup(),events=[event(0),event(1,'stage_changed'),event(2,'npc_utterance'),event(3,'ruling'),event(4,'session_completed')];
 for(const e of events)e.text='acknowledge';
 events[1].snapshot.state.allowedActions[0].label='未來標籤';
 events[2].snapshot.state.allowedActions=[];
 events[3].snapshot.state.allowedActions[0].label='最後確認';
 assert.equal(r.append(events.map(JSON.stringify)),'accepted');
 assert.equal(r.transcript({query:'最後確認'}).length,0);
 r.seek(4);
 assert.deepEqual(r.transcript().map(e=>e.displayText),['acknowledge','確認','acknowledge','acknowledge','最後確認']);
 assert.ok(r.transcript().every(e=>e.text==='acknowledge'));
 assert.equal(r.current.text,'acknowledge');
 assert.equal(r.transcript({query:'最後確認'}).length,1);
 r.seek(0);assert.equal(r.transcript({query:'最後確認'}).length,0);
 const old=setup(),checkpoint=event(7,'checkpoint');checkpoint.text='acknowledge';
 old.append([JSON.stringify(checkpoint)]);assert.equal(old.transcript()[0].displayText,'acknowledge');
});
