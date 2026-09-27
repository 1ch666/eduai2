import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {courtSchemas,assertCourtSchema} from './court-schema-check.mjs';
import {parseSnapshot,parseEvent,parseEventPage} from '../court/protocol.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
function eventOf(snapshot){
  const {state,...envelope}=snapshot;
  return {...envelope,kind:'evidence_presented',speaker:'法官',roleId:'judge',stageId:state.stageId,text:'測試',
    evidenceIds:state.evidence.map(e=>e.evidenceId),citationIds:[],snapshot};
}
const parsers={snapshot:parseSnapshot,event:parseEvent,eventPage:parseEventPage};
function accepts(kind,value){assertCourtSchema(kind,value);assert.ok(parsers[kind](JSON.stringify(value)));}
test('shared Unity fixture, public evidence variants, NPC poses and event pages satisfy both contracts',()=>{
  const value=structuredClone(fixture);
  for(const type of ['image','document','chat','timeline','audioTranscript','objectPhoto','mapDiagram','syntheticRecord','cctvStill']){
    value.state.evidence[0].type=type;accepts('snapshot',value);
  }
  for(const pose of ['idle','speaking','listening','thinking','objecting','presentingEvidence','sitting','standing','turnHeadToSpeaker']){
    value.state.npcs[0].pose=pose;accepts('event',eventOf(value));
  }
  accepts('eventPage',{events:[eventOf(value)],nextAfter:0,currentVersion:0});
  accepts('eventPage',{events:[],nextAfter:0,currentVersion:0});
});
test('nested private fields, missing required properties, invalid enums and oversized collections fail closed',()=>{
  const paths=[[],['state'],['state','allowedActions',0],['state','npcs',0],['state','evidence',0],['state','evidence',0,'metadata',0]];
  for(const path of paths){
    for(const missing of [false,true]){
      const v=structuredClone(fixture);let target=v;for(const key of path)target=target[key];
      if(missing)delete target[Object.keys(target)[0]];else target.privateReasoning='DO NOT PRINT';
      const before=JSON.stringify(v);assert.equal(courtSchemas.snapshot(v),false);
      assert.equal(parseSnapshot(before),null);assert.equal(JSON.stringify(v),before);
    }
  }
  const changes=[v=>v.state.npcs[0].pose='executeScript',v=>v.state.evidence[0].assetId='https://evil.test',
    v=>v.state.allowedActions.push(...Array(40).fill(v.state.allowedActions[0])),
    v=>v.state.evidence[0].metadata.push(...Array(20).fill(v.state.evidence[0].metadata[0])),
    v=>v.state.feedback='中'.repeat(5001),v=>v.stateVersion=-1,v=>v.timestamp='yesterday'];
  for(const change of changes){const v=structuredClone(fixture);change(v);assert.equal(courtSchemas.snapshot(v),false);assert.equal(parseSnapshot(JSON.stringify(v)),null);}
});
test('raw parser still enforces cross-field identity, visibility, unique IDs and real calendar dates',()=>{
  const duplicate=structuredClone(fixture);duplicate.state.npcs.push({...duplicate.state.npcs[0]});
  const hidden=structuredClone(fixture);hidden.state.npcs[0].visible=false;
  const date=structuredClone(fixture);date.timestamp='2026-02-30T00:00:00.000Z';
  for(const v of [duplicate,hidden,date]){
    assert.equal(courtSchemas.snapshot(v),true);assert.equal(parseSnapshot(JSON.stringify(v)),null);
  }
  const identity=eventOf(structuredClone(fixture));identity.stateVersion++;
  const reference=eventOf(structuredClone(fixture));reference.evidenceIds=['hidden-evidence'];
  for(const v of [identity,reference]){
    assert.equal(courtSchemas.event(v),true);assert.equal(parseEvent(JSON.stringify(v)),null);
  }
});
test('event/page boundaries and schema failures never leak payload values',()=>{
  const e=eventOf(structuredClone(fixture));
  const large={events:Array(21).fill(e),nextAfter:0,currentVersion:0};
  assert.equal(courtSchemas.eventPage(large),false);assert.equal(parseEventPage(JSON.stringify(large)),null);
  const v={...fixture,private:'secret-value-never-log'};
  assert.throws(()=>assertCourtSchema('snapshot',v),error=>!error.message.includes(v.private));
  assert.throws(()=>assertCourtSchema('unknown',{}),/Unknown court schema/);
});
