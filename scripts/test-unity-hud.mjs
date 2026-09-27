import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installUnityHud} from '../court/unity-hud.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
function setup(){
 const calls=[],outbound=[],listeners={};
 const parent={postMessage:(message,origin)=>outbound.push({message,origin})};
 const window={parent,location:{origin:'https://court.test'},addEventListener:(name,fn)=>listeners[name]=fn};
 installUnityHud({window,getInstance:()=>({SendMessage:(...args)=>calls.push(args)})});
 const channel=crypto.randomUUID();
 const receive=(type,extra={},origin=window.location.origin,source=parent)=>listeners.message({origin,source,data:{type,apiVersion:1,channel,...extra}});
 return {calls,outbound,receive,listeners,channel};
}
test('HUD handshake carries no credentials and rejects other origins and frames',()=>{
 const x=setup();assert.deepEqual(x.outbound,[{message:{type:'court-hud-ready',apiVersion:1},origin:'https://court.test'}]);
 x.receive('court-hud-bind',{},'https://other.test');x.receive('court-hud-bind',{},'https://court.test',{});
 x.receive('court-hud-snapshot',{payload:JSON.stringify(fixture)});assert.equal(x.calls.length,0);
 x.receive('court-hud-bind');x.receive('court-hud-snapshot',{payload:JSON.stringify(fixture)});
 assert.deepEqual(x.calls.map(c=>c[1]),['ClearState','ApplySnapshot']);assert.ok(x.calls.every(c=>c[0]==='CourtRuntimeState'));
});
test('HUD rejects malformed, cross-session, lower-version and wrong-channel snapshots',()=>{
 const x=setup();x.receive('court-hud-bind');const current={...fixture,stateVersion:2,eventSequence:2};
 x.receive('court-hud-snapshot',{payload:JSON.stringify(current)});const count=x.calls.length;
 for(const snapshot of [{...current,privateTruth:'secret'},{...current,sessionId:crypto.randomUUID()},fixture])x.receive('court-hud-snapshot',{payload:JSON.stringify(snapshot)});
 x.receive('court-hud-snapshot',{channel:crypto.randomUUID(),payload:JSON.stringify(current)});
 x.receive('court-hud-snapshot',{payload:JSON.stringify(current),token:'unexpected'});
 assert.equal(x.calls.length,count);
});
test('clear and page exit remove state and require a new binding',()=>{
 const x=setup();x.receive('court-hud-bind');x.receive('court-hud-snapshot',{payload:JSON.stringify(fixture)});
 x.receive('court-hud-unavailable');assert.equal(x.calls.at(-1)[1],'MarkUnavailable');
 x.receive('court-hud-clear');const count=x.calls.length;
 x.receive('court-hud-snapshot',{payload:JSON.stringify(fixture)});assert.equal(x.calls.length,count);
 x.receive('court-hud-bind');x.receive('court-hud-snapshot',{payload:JSON.stringify({...fixture,sessionId:crypto.randomUUID()})});
 assert.equal(x.calls.at(-1)[1],'ApplySnapshot');x.listeners.pagehide();assert.equal(x.calls.at(-1)[1],'ClearState');
});
