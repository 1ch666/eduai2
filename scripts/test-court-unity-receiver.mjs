import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CourtUnityReceiver} from '../court/unity-receiver.js';
import {CourtUnityBridge} from '../court/unity-bridge.js';
import {CourtTransport} from '../court/transport.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
function setup(){
 const messages=[],snapshots=[],statuses=[];let clears=0;
 const parent={postMessage:(m,o)=>messages.push({m,o})},channel=crypto.randomUUID();
 const r=new CourtUnityReceiver({parent,origin:'https://court.test',onSnapshot:s=>snapshots.push(s),onClear:()=>clears++,onStatus:(...s)=>statuses.push(s)});
 const event=(type,extra={})=>({source:parent,origin:'https://court.test',data:{type,apiVersion:1,channel,...extra}});
 const bind=()=>r.receive(event('court-v1-bind',{sessionId:fixture.sessionId,caseId:fixture.caseId}));
 return {r,messages,snapshots,statuses,event,bind,clears:()=>clears};
}
test('receiver validates parent and binding; correlates state before enabling actions',()=>{
 const x=setup();assert.equal(x.r.receive({...x.event('court-v1-bind'),source:{}}),'wrong-source');
 assert.equal(x.bind(),'bound');assert.equal(x.r.command('acknowledge'),'needs-snapshot');
 assert.equal(x.r.command('refresh'),'sent');assert.equal(x.r.command('refresh'),'pending');
 assert.equal(x.r.receive(x.event('court-v1-snapshot',{sequence:2,payload:JSON.stringify(fixture)})),'uncorrelated');
 assert.equal(x.r.receive(x.event('court-v1-snapshot',{sequence:1,payload:JSON.stringify(fixture)})),'accepted');
 assert.equal(x.r.canAct,false);
 x.r.receive(x.event('court-v1-result',{sequence:1,status:'accepted',canAct:true}));
 assert.equal(x.r.canAct,true);assert.equal(x.r.command('acknowledge'),'sent');
 assert.equal(x.messages.at(-1).m.expectedStateVersion,fixture.stateVersion);
 assert.ok(x.messages.every(x=>x.o==='https://court.test'));
});
test('receiver rejects private fields and clears state on logout',()=>{
 const x=setup();x.bind();x.r.command('refresh');
 assert.equal(x.r.receive(x.event('court-v1-snapshot',{sequence:1,payload:JSON.stringify({...fixture,secret:'hidden'})})),'malformed');
 assert.equal(x.snapshots.length,0);
 x.r.receive(x.event('court-v1-result',{sequence:1,status:'accepted',canAct:true}));assert.equal(x.r.canAct,false);
 assert.equal(x.r.receive(x.event('court-v1-clear')),'cleared');
 assert.equal(x.r.command('refresh'),'no-context');assert.equal(x.clears(),2);
 assert.equal(x.r.receive(x.event('court-v1-snapshot',{sequence:1,payload:JSON.stringify(fixture)})),'wrong-channel');
});
test('both bridge ends deliver a transport snapshot without passing credentials',async()=>{
 let receiver,work;const snapshots=[];
 const frame={postMessage:m=>receiver.receive({source:parent,origin:'https://court.test',data:m})};
 const parent={postMessage:m=>{work=bridge.receive({source:frame,origin:'https://court.test',data:m});}};
 const transport=new CourtTransport({origin:'https://court.test',csrf:()=> 'secret',fetchImpl:async url=>Response.json({...fixture,requestId:new URL(url).searchParams.get('requestId')})});
 const bridge=new CourtUnityBridge({origin:'https://court.test',transport});
 receiver=new CourtUnityReceiver({parent,origin:'https://court.test',onSnapshot:s=>snapshots.push(s),onClear:()=>{},onStatus:()=>{}});
 bridge.bind(frame,fixture.sessionId,fixture.caseId);receiver.command('refresh');
 assert.equal(await work,'accepted');assert.equal(receiver.canAct,true);assert.equal(snapshots.length,1);
 assert.ok(!snapshots[0].includes('secret'));bridge.clear();assert.equal(receiver.canAct,false);
});
