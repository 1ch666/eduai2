import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {parseSnapshot} from '../court/protocol.js';
import {newInvestigation,reduceInvestigation,TABLET_INVESTIGATION} from '../src/court-investigation.ts';
const bundle=await build({entryPoints:['src/court-journal.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {publicCourtSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const context={stage:2,completed:false,role:'judge',availableEvidenceIds:['camera-time'],responsiveNpcIds:['Witness','Prosecutor','Lawyer']};
const state=()=>({id:crypto.randomUUID(),owner:'owner',config:{caseId:TABLET_INVESTIGATION.id,role:'judge'},stage:2,version:3,
 reviewed:[],statements:[],attempts:0,completed:false,feedback:'',createdAt:'2026-10-04T00:00:00Z',updatedAt:'2026-10-04T00:00:00Z',ruleVersion:'test',investigation:newInvestigation()});
const cast=s=>{
 const snapshot=publicCourtSnapshot(s,crypto.randomUUID(),crypto.randomUUID(),'2026-10-04T00:00:00.000Z');
 assert(parseSnapshot(JSON.stringify(snapshot)),'existing client contract must accept public presentation');
 return snapshot.state.npcs;
};
const neutral=s=>assert(cast(s).every(n=>n.emotion==='neutral'));
const discover=s=>{for(const a of [{type:'question',npcId:'Witness'},{type:'view',evidenceId:'camera-time'},{type:'present',npcId:'Witness',evidenceId:'camera-time'}])s.investigation=reduceInvestigation(s.investigation,a,context);};
test('only a committed public contradiction changes the witness posture, then follow-up clears it',()=>{
 const s=state();neutral(s);
 s.investigation=reduceInvestigation(s.investigation,{type:'view',evidenceId:'camera-time'},context);neutral(s);
 discover(s);const before=structuredClone(s),npcs=cast(s);
 assert.equal(npcs.find(n=>n.npcId==='Witness').emotion,'nervous');
 assert(npcs.filter(n=>n.npcId!=='Witness').every(n=>n.emotion==='neutral'));
 assert(npcs.every(n=>n.pose==='sitting'&&n.speakingState==='silent'&&n.requestState==='idle'));
 assert.deepEqual(s,before,'presentation must not mutate state or decide scores');
 s.investigation=reduceInvestigation(s.investigation,{type:'followUp',npcId:'Witness',contradictionId:'departure-time'},context);neutral(s);
});
test('invalid, other-case, completed and out-of-stage states reveal no emotion cue',()=>{
 const s=state();discover(s);
 neutral({...s,completed:true});neutral({...s,stage:3});neutral({...s,config:{...s.config,caseId:'sale'}});
 neutral({...s,investigation:{...s.investigation,heardFactIds:[]}});
 neutral({...s,investigation:undefined});
 const clean=state();neutral({...clean,feedback:'nervous',privateGraph:{hidden:'nervous'}});
 assert(!JSON.stringify(cast(clean)).includes('departure-time'));
});
