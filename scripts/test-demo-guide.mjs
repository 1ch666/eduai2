import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoGuide} from '../court/demo-guide.js';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}
}
const walk=e=>[e,...e.children.flatMap(walk)];
function setup(){
 const ui=createDemoGuide({createElement:tag=>new Element(tag)});
 const state={sessionId:'one',caseId:'case',state:{completed:false,npcs:[{visible:true,displayName:'證人'},{visible:false,displayName:'秘密角色'}],allowedActions:[{actionId:'investigate.discover',enabled:true}]}};
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
