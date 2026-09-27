import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CourtTransport} from '../court/transport.js';
import {CourtUnityBridge} from '../court/unity-bridge.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
function setup(fetchImpl){
 const sent=[],peer={postMessage:(data,origin)=>sent.push({data,origin})};
 const transport=new CourtTransport({origin:'https://court.test',csrf:()=> 'private-csrf',fetchImpl});
 const bridge=new CourtUnityBridge({transport,origin:'https://court.test'});
 bridge.bind(peer,fixture.sessionId,fixture.caseId);
 const channel=sent[0].data.channel;
 const command=(sequence,actionId='refresh',extra={})=>({source:peer,origin:'https://court.test',data:{type:'court-v1-command',apiVersion:1,channel,sequence,expectedStateVersion:0,actionId,targetId:'',text:'',...extra}});
 return {bridge,transport,sent,peer,command};
}
const reply=url=>Response.json({...fixture,requestId:new URL(url).searchParams.get('requestId')});
test('bridge verifies exact origin, window, channel, shape and monotonic sequence',async()=>{
 let calls=0;const x=setup(async url=>{calls++;return reply(url);});
 assert.equal(await x.bridge.receive({...x.command(1),origin:'https://evil.test'}),'wrong-source');
 assert.equal(await x.bridge.receive({...x.command(1),source:{}}),'wrong-source');
 assert.equal(await x.bridge.receive(x.command(1,'refresh',{channel:crypto.randomUUID()})),'wrong-channel');
 assert.equal(await x.bridge.receive(x.command(1,'refresh',{score:100})),'malformed');
 assert.equal(calls,0);assert.equal(await x.bridge.receive(x.command(1)),'accepted');
 assert.equal(await x.bridge.receive(x.command(1)),'malformed');assert.equal(calls,1);
 assert.ok(x.sent.every(m=>m.origin==='https://court.test'));
 assert.ok(!JSON.stringify(x.sent).includes('private-csrf'));
 assert.equal(x.sent.at(-1).data.canAct,true);
});
test('stale rendered action cannot execute against newer shell state',async()=>{
 let posts=0;const x=setup(async(url,o)=>{if(o.method==='POST')posts++;return reply(url);});
 await x.bridge.receive(x.command(1));
 assert.equal(await x.bridge.receive(x.command(2,'acknowledge',{expectedStateVersion:99})),'needs-snapshot');
 assert.equal(posts,0);
});
test('rebind invalidates old frame commands and in-flight replies',async()=>{
 let finish;const x=setup(()=>new Promise(r=>finish=r));
 const waiting=x.bridge.receive(x.command(1));
 assert.equal(await x.bridge.receive(x.command(2)),'busy');
 x.bridge.bind(x.peer,fixture.sessionId,fixture.caseId);
 const count=x.sent.length;
 finish(Response.json(fixture));assert.equal(await waiting,'obsolete-context');
 assert.equal(x.sent.length,count);
 assert.equal(await x.bridge.receive(x.command(3)),'wrong-channel');
 assert.equal(x.transport.snapshot,null);
});
test('401 clears Unity private view and disables actions',async()=>{
 const x=setup(async()=>new Response('',{status:401}));
 assert.equal(await x.bridge.receive(x.command(1)),'login-required');
 assert.equal(x.sent.at(-2).data.type,'court-v1-clear');
 assert.equal(x.sent.at(-1).data.canAct,false);
});
