import test from 'node:test';
import assert from 'node:assert/strict';
import {actionTargets,actionTargetStatus} from '../court/action-targets.js';
const action={requiredTarget:'npc',enabled:true,reasonDisabled:''};
const state={npcs:[
 {npcId:'witness',displayName:'證人',visible:true,interactable:true,requestState:'idle'},
 {npcId:'hidden',displayName:'不可見',visible:false,interactable:false,requestState:'idle'},
 {npcId:'locked',displayName:'不可互動',visible:true,interactable:false,requestState:'idle'},
 {npcId:'busy',displayName:'等待中',visible:true,interactable:true,requestState:'pending'}
],evidence:[{evidenceId:'receipt',title:'收據'}]};
test('only server-visible and interactable non-pending NPCs become options',()=>{
 assert.deepEqual(actionTargets({state},'npc'),[{id:'witness',label:'證人'}]);
 for(const id of ['hidden','locked','busy','invented',''])assert.equal(actionTargetStatus({state},action,id).enabled,false);
 assert.deepEqual(actionTargetStatus({state},action,'witness'),{enabled:true,reason:'',targetId:'witness'});
});
test('target selection never overrides server disabled or unknown target type',()=>{
 assert.equal(actionTargetStatus({state},{...action,enabled:false,reasonDisabled:'尚未開放'},'witness').reason,'尚未開放');
 assert.equal(actionTargetStatus({state},{...action,requiredTarget:'private'},'witness').enabled,false);
 assert.equal(actionTargetStatus(null,action,'witness').enabled,false);
});
test('missing evidence and removed NPCs do not retain stale targets',()=>{
 const evidence={...action,requiredTarget:'evidence'};
 assert.equal(actionTargetStatus({state},evidence,'receipt').enabled,true);
 assert.equal(actionTargetStatus({state:{npcs:[],evidence:[]}},evidence,'receipt').enabled,false);
 assert.equal(actionTargetStatus({state:{npcs:[],evidence:[]}},action,'witness').enabled,false);
 assert.deepEqual(actionTargetStatus({state},{...action,requiredTarget:'none'},'witness'),{enabled:true,reason:'',targetId:''});
});
