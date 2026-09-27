import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installSnapshotRelay} from '../court/snapshot-relay.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(t){
 const listeners={},messages=[],requests=[];
 const peer={postMessage:(message,origin)=>messages.push({message,origin})};
 const window={location:{origin:'https://court.test'},addEventListener:(name,fn)=>listeners[name]=fn};
 let view={id:fixture.sessionId,config:{caseId:fixture.caseId},version:0},account={id:'owner'};
 const original=globalThis.fetch;
 globalThis.fetch=(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
 t.after(()=>{relay.clear();globalThis.fetch=original;});
 const relay=installSnapshotRelay({window,getFrame:()=>({contentWindow:peer}),getView:()=>view,getAccount:()=>account});
 const ready=(extra={},source=peer,origin=window.location.origin)=>listeners.message({source,origin,data:{type:'court-hud-ready',apiVersion:1,...extra}});
 const reply=(i,status=200,patch={})=>requests[i].resolve(new Response(status===200?JSON.stringify({...fixture,requestId:new URL(requests[i].url).searchParams.get('requestId'),...patch}):'{}',{status}));
 return {relay,requests,messages,listeners,ready,reply,setView:v=>view=v,setAccount:a=>account=a};
}
test('relay accepts only exact same-origin frame handshake; GET has no CSRF or body',async t=>{
 const x=setup(t);x.ready({},{});x.ready({},undefined,'https://evil.test');x.ready({token:'unexpected'});
 assert.equal(x.requests.length,0);x.ready();assert.equal(x.requests.length,1);
 assert.equal(x.requests[0].options.method,'GET');assert.equal(x.requests[0].options.body,undefined);
 assert.equal(x.requests[0].options.headers['X-CSRF-Token'],undefined);
 x.reply(0);await settle();assert.equal(x.messages.at(-1).message.type,'court-hud-snapshot');
 assert.ok(x.messages.every(m=>m.origin==='https://court.test'));
 await x.relay.sync();assert.equal(x.requests.length,1);
});
test('logout or case change during a request clears the frame, never delivers late state',async t=>{
 const x=setup(t);x.ready();x.setAccount({id:'different-owner'});x.reply(0);await settle();
 assert.equal(x.messages.at(-1).message.type,'court-hud-clear');
 assert.equal(x.messages.filter(m=>m.message.type==='court-hud-snapshot').length,0);
 x.ready();x.setView({id:fixture.sessionId,config:{caseId:'different-case'},version:0});x.reply(1);await settle();
 assert.equal(x.messages.at(-1).message.type,'court-hud-clear');
});
test('new handshake aborts the old request and ignores its late response',async t=>{
 const x=setup(t);x.ready();const oldChannel=x.messages.at(-1).message.channel;x.ready();
 assert.equal(x.requests[0].options.signal.aborted,true);x.reply(0);x.reply(1);await settle();
 const snapshots=x.messages.filter(m=>m.message.type==='court-hud-snapshot');
 assert.equal(snapshots.length,1);assert.notEqual(snapshots[0].message.channel,oldChannel);
});
test('offline suppresses in-flight snapshot; online rechecks unchanged version and recovers',async t=>{
 const x=setup(t);x.ready();x.listeners.offline();x.reply(0);await settle();
 assert.equal(x.messages.at(-1).message.type,'court-hud-unavailable');
 assert.equal(x.messages.filter(m=>m.message.type==='court-hud-snapshot').length,0);
 x.listeners.online();x.reply(1);await settle();assert.equal(x.messages.at(-1).message.type,'court-hud-snapshot');
 x.listeners.online();assert.equal(x.requests.length,3);x.reply(2);await settle();
});
test('online during an in-flight request queues a fresh read instead of skipping version',async t=>{
 const x=setup(t);x.ready();x.listeners.offline();x.listeners.online();x.reply(0);await settle();
 assert.equal(x.requests.length,2);x.reply(1);await settle();
 assert.equal(x.messages.at(-1).message.type,'court-hud-snapshot');
});
test('expired login and forbidden access clear protected HUD state',async t=>{
 const x=setup(t);x.ready();x.reply(0,401);await settle();
 assert.equal(x.messages.at(-1).message.type,'court-hud-clear');
 x.ready();x.reply(1,403);await settle();assert.equal(x.messages.at(-1).message.type,'court-hud-clear');
});
test('failed forced refresh allows subsequent normal sync of the unchanged version',async t=>{
 const x=setup(t);x.ready();x.reply(0);await settle();
 x.listeners.online();x.reply(1,500);await settle();
 assert.equal(x.messages.at(-1).message.type,'court-hud-unavailable');
 const pending=x.relay.sync();assert.equal(x.requests.length,3);x.reply(2);await pending;
 assert.equal(x.messages.at(-1).message.type,'court-hud-snapshot');
});
test('malformed snapshot never reaches Unity and pagehide blocks pending delivery',async t=>{
 const x=setup(t);x.ready();x.reply(0,200,{privateTruth:'must-not-pass'});await settle();
 assert.equal(x.messages.at(-1).message.type,'court-hud-unavailable');
 const pending=x.relay.sync();x.listeners.pagehide();x.reply(1);await pending;
 assert.equal(x.messages.filter(m=>m.message.type==='court-hud-snapshot').length,0);
 assert.equal(x.messages.at(-1).message.type,'court-hud-clear');
});
