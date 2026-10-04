import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidancePresentation} from '../court/guidance-presentation.js';
function setup(){
 const elements=Array.from({length:4},()=>({hidden:false}));let cancelled=0;
 const ui=createGuidancePresentation({elements,cancelSpeech:()=>cancelled++});
 const view={id:'case-one',version:2,investigation:{},completed:false};
 return {ui,elements,view,cancelled:()=>cancelled};
}
test('challenge hides all guidance and cancels speech without changing the case',()=>{
 const {ui,elements,view,cancelled}=setup(),before=structuredClone(view);
 ui.update(view,'normal','owner');const ticket=ui.ticket();assert(ui.accepts(ticket));
 ui.update(view,'challenge','owner');assert(!ui.allowed);assert(elements.every(e=>e.hidden));
 assert.equal(cancelled(),1);assert(!ui.accepts(ticket));assert.equal(ui.ticket(),null);
 ui.update(view,'tutorial','owner');assert(elements.every(e=>!e.hidden));assert(!ui.accepts(ticket));
 assert.deepEqual(view,before);
});
test('late guidance cannot cross session, owner, version, mode or logout boundaries',()=>{
 for(const change of [v=>({...v,id:'other'}),v=>({...v,version:3}),()=>null]){
  const {ui,view}=setup();ui.update(view,'normal','owner');const t=ui.ticket();
  ui.update(change(view),'normal','owner');assert(!ui.accepts(t));
 }
 const {ui,view}=setup();ui.update(view,'normal','owner');const t=ui.ticket();
 ui.update(view,'normal','other');assert(!ui.accepts(t));
 const fresh=ui.ticket();ui.update(view,'normal','other');assert(ui.accepts(fresh));
 ui.update(view,'tutorial','other');assert(!ui.accepts(fresh));
});
test('completed review and legacy cases preserve guidance in every difficulty',()=>{
 const {ui,view}=setup();ui.update({...view,completed:true},'challenge','owner');assert(ui.allowed);
 ui.update({...view,investigation:null},'challenge','owner');assert(ui.allowed);
 ui.update(null,'normal');assert(!ui.allowed);
});
