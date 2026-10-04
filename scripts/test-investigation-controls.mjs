import test from 'node:test';
import assert from 'node:assert/strict';
import {createInvestigationControls,isInvestigationControlAction} from '../court/investigation-controls.js';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}
 focus(){this.focused=true;}
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

const publicView=(s,heard=[],statements=[])=>({id:s.sessionId,version:s.stateVersion,config:{caseId:s.caseId},investigation:{questionedNpcIds:heard,statements}});
test('same-version server records show heard status; next role shortcut never submits a question',()=>{
 const {ui,calls,buttons}=setup(),s=fixture();s.stateVersion=4;
 const view=publicView(s,['Witness'],[{npcId:'Witness',text:'已聽取的時間陳述'}]),before=structuredClone({s,view});
 ui.setSnapshot(s,false,'normal',view);
 const text=()=>walk(ui.element).map(e=>e.textContent).join('\n');
 assert.match(text(),/證人 · 已聽取原始陳述/);assert.match(text(),/律師 · 尚未聽取原始陳述/);
 assert.match(text(),/已聽取的時間陳述/);
 buttons().find(b=>b.textContent==='切換尚未詢問角色：律師').onclick();
 const select=walk(ui.element).find(e=>e.tag==='select');assert.equal(select.value,'Lawyer');assert.equal(select.focused,true);
 assert.deepEqual(calls,[]);assert(!text().includes('已聽取的時間陳述'));
 assert.match(text(),/自由提問不等於完成/);assert.deepEqual({s,view},before);
 buttons().find(b=>b.textContent==='investigate.question.Lawyer').onclick();assert.deepEqual(calls,['investigate.question.Lawyer']);
});

test('mismatched notebook never supplies progress or testimony; hidden roles remain hidden',()=>{
 const {ui}=setup(),s=fixture();s.stateVersion=2;
 const view=publicView(s,['Witness'],[{npcId:'Witness',text:'HEARD-ONLY'},{npcId:'Hidden',text:'HIDDEN-TEXT'}]);
 const text=()=>walk(ui.element).map(e=>e.textContent).join('\n');
 for(const other of [{...view,id:'other'},{...view,version:3},{...view,config:{caseId:'other'}},null]){
  ui.setSnapshot(s,false,'normal',other);assert(!text().includes('HEARD-ONLY'));assert(!text().includes('已聽取原始陳述'));
 }
 ui.setSnapshot(s,false,'normal',view);assert(text().includes('HEARD-ONLY'));assert(!text().includes('HIDDEN-TEXT'));
 s.state.npcs[0].visible=false;ui.setSnapshot(s,false,'normal',view);assert(!text().includes('HEARD-ONLY'));
 ui.setSnapshot(null);assert(!text().includes('HEARD-ONLY'));
});

test('role shortcuts are blocked on pending, rerender, challenge, completion and context changes',()=>{
 const {ui,calls,buttons}=setup(),s=fixture();s.stateVersion=1;const view=publicView(s,['Witness']);
 const getShortcut=()=>buttons().find(b=>b.textContent.startsWith('切換尚未詢問角色'));
 for(const change of [()=>ui.setSnapshot(s,true,'normal',view),()=>ui.setSnapshot(s,false,'challenge',view),()=>ui.setSnapshot({...s,sessionId:'other'},false,'normal',view),()=>ui.setSnapshot({...s,state:{...s.state,completed:true}},false,'normal',view),()=>ui.setSnapshot(s,false,'normal',view)]){
  ui.setSnapshot(null);ui.setSnapshot(s,false,'normal',view);const old=getShortcut();assert(old);change();old.onclick();
  const select=walk(ui.element).find(e=>e.tag==='select');assert.notEqual(select.value,'Lawyer');assert.deepEqual(calls,[]);
 }
 ui.setSnapshot(s,false,'challenge',view);assert.equal(getShortcut(),undefined);
});

test('heard evidence strings remain literal and progress does not invent missing records',()=>{
 const {ui}=setup(),s=fixture();s.stateVersion=1;
 const view=publicView(s,[],[{npcId:'Witness',text:'<img onerror=alert(1)>'}]);
 ui.setSnapshot(s,false,'normal',view);
 assert(walk(ui.element).every(e=>!Object.hasOwn(e,'innerHTML')));
 assert(walk(ui.element).some(e=>e.textContent==='證人 · 尚未聽取原始陳述'));
 assert(!walk(ui.element).some(e=>e.textContent==='<img onerror=alert(1)>'));
 view.investigation.questionedNpcIds=['Witness'];ui.setSnapshot(s,false,'normal',view);
 assert(walk(ui.element).some(e=>e.textContent==='<img onerror=alert(1)>'));
 assert(walk(ui.element).every(e=>!Object.hasOwn(e,'innerHTML')));
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

test('presentation difficulty changes hints, never server actions or case data',()=>{
 const {ui,calls,buttons}=setup(),s=fixture(),original=structuredClone(s);
 ui.setSnapshot(s,false,'normal');const oldHint=buttons().find(b=>b.textContent==='investigate.hint');
 ui.setSnapshot(s,false,'challenge');
 assert(!buttons().some(b=>b.textContent==='investigate.hint'));oldHint.onclick();assert.equal(calls.length,0);
 buttons().find(b=>b.textContent==='investigate.question.Witness').onclick();assert.equal(calls.length,1);
 ui.setSnapshot(s,false,'tutorial');assert(walk(ui.element).some(e=>e.textContent.includes('發現矛盾不等於證明犯罪')));
 assert(buttons().some(b=>b.textContent==='investigate.hint'));assert.deepEqual(s,original);
});
