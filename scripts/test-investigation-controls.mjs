import test from 'node:test';
import assert from 'node:assert/strict';
import {createInvestigationControls,isInvestigationControlAction} from '../court/investigation-controls.js';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}
}
const walk=e=>[e,...e.children.flatMap(walk)];
const action=id=>({actionId:id,label:id,enabled:true,requiredTarget:'none'});
const fixture=()=>({sessionId:'one',caseId:'case',state:{completed:false,evidence:[],npcs:[{npcId:'Witness',displayName:'證人',visible:true,interactable:true,requestState:'idle'},{npcId:'Lawyer',displayName:'律師',visible:true,interactable:true,requestState:'idle'}],allowedActions:['investigate.discover','investigate.question.Witness','investigate.question.Lawyer','investigate.hint'].map(action)}});
function setup(){const calls=[],ui=createInvestigationControls({document:{createElement:t=>new Element(t)},onAction:id=>calls.push(id)});return {ui,calls,buttons:()=>walk(ui.element).filter(e=>e.tag==='button')};}
test('investigation presents only visible evidence and server-authorized selected NPC actions',()=>{
 const {ui,calls,buttons}=setup(),s=fixture();ui.setSnapshot(s);
 assert(!ui.element.hidden);assert(!buttons().some(b=>b.textContent.includes('present')));
 buttons().find(b=>b.textContent==='investigate.question.Witness').onclick();assert.deepEqual(calls,['investigate.question.Witness']);
 const select=walk(ui.element).find(e=>e.tag==='select');select.value='Lawyer';select.onchange();
 assert(!buttons().some(b=>b.textContent.endsWith('.Witness')));
 s.state.evidence=[{title:'<img onerror=alert(1)>',text:'時間紀錄'}];s.state.allowedActions.push(action('investigate.present.Lawyer'));
 ui.setSnapshot(s);assert(buttons().some(b=>b.textContent==='investigate.present.Lawyer'));
 assert(walk(ui.element).some(e=>e.textContent.includes('<img onerror')));assert(walk(ui.element).every(e=>!Object.hasOwn(e,'innerHTML')));
});
test('pending, revoked actions, completed review and cleared sessions cannot send stale operations',()=>{
 const {ui,calls,buttons}=setup(),s=fixture();ui.setSnapshot(s);
 const old=buttons().find(b=>b.textContent==='investigate.question.Witness');
 ui.setSnapshot(s,true);old.onclick();assert.equal(calls.length,0);assert(buttons().every(b=>b.disabled));
 s.state.allowedActions=s.state.allowedActions.filter(a=>a.actionId!=='investigate.question.Witness');ui.setSnapshot(s);old.onclick();assert.equal(calls.length,0);
 s.state.completed=true;ui.setSnapshot(s);assert(ui.element.hidden);old.onclick();assert.equal(calls.length,0);
 ui.setSnapshot(null);assert(ui.element.hidden);assert.equal(buttons().length,0);
});
test('old buttons cannot cross sessions or target a hidden NPC; new action kinds remain on the generic panel',()=>{
 const {ui,calls,buttons}=setup(),s=fixture();ui.setSnapshot(s);
 const old=buttons().find(b=>b.textContent==='investigate.question.Witness');
 ui.setSnapshot({...s,sessionId:'two'});old.onclick();assert.equal(calls.length,0);
 const next=buttons().find(b=>b.textContent==='investigate.question.Witness');s.state.npcs[0].visible=false;
 ui.setSnapshot({...s,sessionId:'two'});next.onclick();assert.equal(calls.length,0);
 assert.equal(isInvestigationControlAction('investigate.futureAction'),false);
});
