import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoGuide,demoNextStep} from '../court/demo-guide.js';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}
}
const walk=e=>[e,...e.children.flatMap(walk)];
function setup(){
 const ui=createDemoGuide({createElement:tag=>new Element(tag)});
 const state={sessionId:'one',caseId:'case',state:{roleId:'judge',procedure:'criminal',completed:false,npcs:[{visible:true,displayName:'證人'},{visible:false,displayName:'秘密角色'}],allowedActions:['investigate.question.Witness','investigate.discover','investigate.present.Witness','investigate.followUp.Witness','rule.request.allow','closeEvidence'].map(actionId=>({actionId,enabled:true}))}};
 const board={objectives:['question-roles','key-evidence','reasoning','follow-up'].map(id=>({id,label:id,done:false}))};
 const toggle=walk(ui.element).find(e=>e.tag==='input');
 const text=()=>walk(ui.element).map(e=>e.textContent).join('\n');
 return {ui,state,board,toggle,text};
}
test('demo opt-in follows server objectives without inventing completion or sending actions',()=>{
 const {ui,state,board,toggle,text}=setup();ui.setState(state,board,false);
 assert.equal(toggle.checked,false);toggle.checked=true;toggle.onchange();
 assert.match(text(),/依序選擇角色/);assert(!text().includes('秘密角色'));
 board.objectives[0].done=true;ui.setState(state,board,false);assert.match(text(),/取得證物/);
 board.objectives[1].done=true;ui.setState(state,board,false);assert.match(text(),/相關角色出示/);
 board.objectives[2].done=true;ui.setState(state,board,false);assert.match(text(),/解鎖的追問/);
 board.objectives[3].done=true;ui.setState(state,board,false);assert.match(text(),/自行決定准駁/);
 assert.equal(walk(ui.element).filter(e=>e.tag==='button').length,0);
});

test('every player role receives only guidance supported by current server actions',()=>{
 for(const role of ['judge','claimant','respondent','claimantCounsel','respondentCounsel']){
  const {state,board}=setup();state.state.roleId=role;
  const setActions=(...ids)=>state.state.allowedActions=ids.map(actionId=>({actionId,enabled:true}));
  setActions('acknowledge');assert.equal(demoNextStep(state,board).target,'procedure');
  setActions('speak','npc.ask');assert.equal(demoNextStep(state,board).target,'statement');
  for(const goal of board.objectives)goal.done=true;
  setActions('investigate.question.Witness','closeEvidence',...(role==='judge'?['rule.request.allow','rule.request.deny']:[]));
  const before=structuredClone({state,board}),next=demoNextStep(state,board);
  assert.equal(next.target,'procedure');
  if(role==='judge')assert.match(next.text,/自行決定准駁/);
  else {assert.match(next.text,/結束調查/);assert(!next.text.includes('准駁'));}
  setActions('answer.0','answer.1');assert.match(demoNextStep(state,board).text,/不代選答案/);
  assert.deepEqual(board,before.board);
 }
});

test('unavailable follow-up is never advertised and unknown actions never cause progression',()=>{
 const {state,board}=setup();board.objectives.forEach(o=>o.done=o.id!=='follow-up');
 state.state.allowedActions=[{actionId:'investigate.followUp.Witness',enabled:false},{actionId:'closeEvidence',enabled:true},{actionId:'investigate.hint',enabled:true}];
 const before=structuredClone({state,board}),next=demoNextStep(state,board);
 assert.match(next.text,/尚未完成/);assert(!next.text.includes('按伺服器解鎖'));assert.equal(next.target,'investigation');
 assert.deepEqual({state,board},before);
 state.state.allowedActions=[{actionId:'future.action',enabled:true}];assert.equal(demoNextStep(state,board).target,null);
});

test('observer introduction and server step do not claim player investigation or choose answers',()=>{
 const {ui,state,board,toggle,text}=setup();state.state.roleId='observer';state.state.allowedActions=[{actionId:'step',enabled:true}];
 ui.setState(state,board,false);toggle.checked=true;toggle.onchange();
 assert.match(text(),/你的角色：旁觀者/);assert.match(text(),/不替玩家累計調查成果/);
 assert.equal(demoNextStep(state,board).target,'procedure');
 state.state.completed=true;assert.equal(demoNextStep(state,board).target,'review');
});
test('demo handles recovery, withheld board, session switch and completed read-only state',()=>{
 const {ui,state,board,toggle,text}=setup();ui.setState(state,board,false);toggle.checked=true;toggle.onchange();
 ui.setState(state,board,true);assert.match(text(),/等待伺服器確認/);
 ui.setState(state,null,false);assert(ui.element.hidden);assert(!text().includes('證人'));
 state.state.completed=true;ui.setState(state,board,false);assert.match(text(),/已完成/);
 ui.setState({...state,sessionId:'two'},board,false);assert.equal(toggle.checked,false);
 ui.setState(null,null,true);assert(ui.element.hidden);
});
test('demo never chooses final answer and renders role names as text',()=>{
 const {ui,state,board,toggle,text}=setup();state.state.npcs[0].displayName='<img onerror=alert(1)>';
 state.state.allowedActions=[{actionId:'answer.2',enabled:true}];
 ui.setState(state,board,false);toggle.checked=true;toggle.onchange();
 assert.match(text(),/不代選答案/);assert.match(text(),/<img onerror/);
 assert(walk(ui.element).every(e=>!Object.hasOwn(e,'innerHTML')));
});
test('optional shortcuts only navigate and obsolete controls cannot act after state replacement',()=>{
 const calls=[],ui=createDemoGuide({createElement:tag=>new Element(tag)},target=>calls.push(target));
 const {state,board}=setup();ui.setState(state,board,false);
 const toggle=walk(ui.element).find(e=>e.tag==='input');toggle.checked=true;toggle.onchange();
 const button=walk(ui.element).find(e=>e.tag==='button');button.onclick();assert.deepEqual(calls,['investigation']);
 ui.setState(state,board,true);button.onclick();assert.deepEqual(calls,['investigation']);
 assert.equal(walk(ui.element).filter(e=>e.tag==='button').length,0);
 state.state.completed=true;ui.setState(state,board,false);
 const review=walk(ui.element).find(e=>e.tag==='button');review.onclick();assert.deepEqual(calls,['investigation','review']);
 ui.setState(null,null,true);review.onclick();assert.equal(calls.length,2);
});
