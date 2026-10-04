import test from 'node:test';
import assert from 'node:assert/strict';
import {newInvestigation,reduceInvestigation,investigationBoard} from '../src/court-investigation.ts';
const context={stage:2,completed:false,role:'judge',availableEvidenceIds:['camera-time'],responsiveNpcIds:['Witness','Prosecutor','Lawyer']};
const view={type:'view',evidenceId:'camera-time'},ask={type:'question',npcId:'Witness'},present={type:'present',npcId:'Witness',evidenceId:'camera-time'},follow={type:'followUp',npcId:'Witness',contradictionId:'departure-time'};
test('authored evidence and statement unlock one contradiction then targeted follow-up',()=>{
 const initial=newInvestigation();let s=initial;
 assert(!JSON.stringify(investigationBoard(s)).includes('走廊影像'));
 assert.throws(()=>reduceInvestigation(s,present,context));
 s=reduceInvestigation(s,view,context);
 s=reduceInvestigation(s,present,context);assert.equal(s.foundContradictionIds.length,0);
 assert.throws(()=>reduceInvestigation(s,follow,context));
 s=reduceInvestigation(s,ask,context);s=reduceInvestigation(s,present,context);
 s=reduceInvestigation(s,present,context);assert.deepEqual(s.foundContradictionIds,['departure-time']);
 s=reduceInvestigation(s,follow,context);s=reduceInvestigation(s,follow,context);
 assert.deepEqual(s.followedContradictionIds,['departure-time']);
 assert(investigationBoard(s).contradictions[0].explanation.includes('不等於已證明'));
 assert.deepEqual(initial,newInvestigation(),'never mutate source state');
});
test('hidden evidence, wrong NPC/stage, observer and completed results cannot be changed',()=>{
 let s=newInvestigation();for(const a of [view,ask,present])s=reduceInvestigation(s,a,context);
 const before=structuredClone(s);
 for(const c of [{...context,completed:true},{...context,stage:3},{...context,role:'observer'},{...context,responsiveNpcIds:[]},{...context,availableEvidenceIds:[]}])
  assert.throws(()=>reduceInvestigation(s,present,c));
 assert.throws(()=>reduceInvestigation(s,{...present,evidenceId:'hidden'},context));
 assert.throws(()=>reduceInvestigation(s,{...follow,npcId:'Lawyer'},context));
 assert.throws(()=>reduceInvestigation(s,present,{...context,role:'invented'}));
 assert.throws(()=>reduceInvestigation(s,{...follow,contradictionId:'invented-by-model'},context));
 assert.deepEqual(s,before);
 assert.equal(investigationBoard(s).contradictions.length,1,'review remains read-only');
});
