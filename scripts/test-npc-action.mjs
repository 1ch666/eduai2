import test from 'node:test';
import assert from 'node:assert/strict';
import {askNpcThroughTransport,createNpcTicketGate} from '../court/npc-action.js';
function setup(){
 const calls=[];
 const transport={pending:null,recoveryBlocked:false,snapshot:{state:{allowedActions:[{actionId:'npc.ask',enabled:true,requiredTarget:'npc'}],npcs:[{npcId:'Witness',visible:true,interactable:true,requestState:'idle'}]}},
  async refresh(){calls.push('refresh');return 'accepted';},async act(...args){calls.push(args);return 'accepted';}};
 return {calls,transport};
}
test('Unity question refreshes authoritative snapshot and uses shell-owned action transport',async()=>{
 const {calls,transport}=setup();assert.equal(await askNpcThroughTransport(transport,'Witness','你好'),'accepted');
 assert.deepEqual(calls,['refresh',['npc.ask',{targetId:'Witness',text:'你好'}]]);
});
test('invalid, pending and unavailable persistence never start another request',async()=>{
 for(const kind of ['blank','long','pending','storage']){
  const {calls,transport}=setup();if(kind==='pending')transport.pending={};if(kind==='storage')transport.recoveryBlocked=true;
  await askNpcThroughTransport(transport,'Witness',kind==='blank'?' ':kind==='long'?'字'.repeat(401):'你好');assert.equal(calls.length,0);
 }
});
test('hidden, disabled, removed NPC or context switch after refresh never POSTs',async()=>{
 for(const kind of ['hidden','disabled','removed','context','action']){
  const {calls,transport}=setup();if(kind==='hidden')transport.snapshot.state.npcs[0].visible=false;
  if(kind==='disabled')transport.snapshot.state.npcs[0].interactable=false;
  if(kind==='removed')transport.snapshot.state.npcs=[];
  if(kind==='action')transport.snapshot.state.allowedActions=[];
  const r=await askNpcThroughTransport(transport,'Witness','你好',()=>kind!=='context');
  assert.equal(r,kind==='context'?'obsolete-context':'not-allowed');assert.deepEqual(calls,['refresh']);
 }
});
test('failed refresh propagates without falling back to legacy NPC POST',async()=>{
 const {calls,transport}=setup();transport.refresh=async()=> 'login-required';
 assert.equal(await askNpcThroughTransport(transport,'Witness','你好'),'login-required');assert.deepEqual(calls,[]);
});
test('UI ticket duplicates share one attempt and changed payload is rejected',async()=>{
 const gate=createNpcTicketGate();let calls=0,finish;const submit=()=>{calls++;return new Promise(r=>finish=r);};
 const first=gate.run('a','ticket','Witness','你好',submit),duplicate=gate.run('a','ticket','Witness','你好',submit);
 await Promise.resolve();assert.equal(calls,1);assert.equal(await gate.run('a','ticket','Judge','你好',submit),'conflict');
 finish('accepted');assert.equal(await first,'accepted');assert.equal(await duplicate,'accepted');
 assert.equal(await gate.run('a','ticket','Witness','你好',submit),'accepted');assert.equal(calls,1);
});
test('ticket gate is bounded and context reset does not reuse another account result',async()=>{
 const gate=createNpcTicketGate();for(let i=0;i<40;i++)await gate.run('a',String(i),'Witness','問',async()=> 'accepted');
 assert.equal(await gate.run('a','41','Witness','問',async()=>assert.fail()),'rate-limited');
 assert.equal(await gate.run('b','0','Witness','問',async()=> 'new-owner'),'new-owner');
 gate.clear();assert.equal(await gate.run('b','0','Witness','問',async()=> 'cleared'),'cleared');
});
