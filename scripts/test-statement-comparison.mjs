import test from 'node:test';
import assert from 'node:assert/strict';
import {createStatementComparison} from '../court/statement-comparison.js';
class Element{
 constructor(tag){this.tag=tag;this.textContent='';this.children=[];}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}
}
const walk=e=>[e,...e.children.flatMap(walk)];
const text=e=>walk(e).map(n=>n.textContent).join('\n');
const setup=()=>createStatementComparison({createElement:t=>new Element(t)});
test('only discovered evidence and heard statements are compared, without declaring a contradiction',()=>{
 const ui=setup();ui.setBoard({statements:[],evidence:[]});
 assert.match(text(ui.element),/先聽取/);assert(walk(ui.element).filter(n=>n.tag==='select').every(n=>n.disabled));
 const board={statements:[{npcId:'Witness',text:'20:00 已離開'}],evidence:[{title:'現場紀錄',text:'20:17 仍在現場'},{title:'另一紀錄',text:'另一筆已解鎖資料'}]};
 const original=structuredClone(board);ui.setBoard(board);
 assert.match(text(ui.element),/20:00 已離開/);assert.match(text(ui.element),/20:17 仍在現場/);
 assert.match(text(ui.element),/不判定矛盾/);
 const select=walk(ui.element).filter(n=>n.tag==='select')[1];select.value='1';select.onchange();
 assert.match(text(ui.element),/另一筆已解鎖資料/);assert(!text(ui.element).includes('20:17'));
  assert.deepEqual(board,original);assert(!walk(ui.element).some(n=>n.tag==='button'));
  ui.setBoard({...board,completed:true});assert.match(text(ui.element),/庭後唯讀/);
  assert(!text(ui.element).includes('出示證物後'));
});
test('clearing and replacing sessions removes previous text and rejects stale callbacks',()=>{
 const ui=setup();ui.setBoard({statements:[{npcId:'Witness',text:'OLD-PRIVATE'}],evidence:[]});
 const select=walk(ui.element).find(n=>n.tag==='select'),old=select.onchange;
 ui.setBoard(null);old();assert(ui.element.hidden);assert(!text(ui.element).includes('OLD-PRIVATE'));
 ui.setBoard({statements:[],evidence:[{title:'NEW',text:'NEW-TEXT'}]});old();
 assert(!text(ui.element).includes('OLD-PRIVATE'));assert.match(text(ui.element),/NEW-TEXT/);
});
test('HTML-like public text stays literal; unknown selector values cannot reveal other data',()=>{
 const ui=setup();ui.setBoard({statements:[{npcId:'<svg onload=alert(1)>',text:'<script>bad</script>'}],evidence:[]});
 assert.match(text(ui.element),/<script>bad<\/script>/);
 assert(walk(ui.element).every(n=>!Object.hasOwn(n,'innerHTML')));
 const select=walk(ui.element).find(n=>n.tag==='select');select.value='99';select.onchange();
 assert(!text(ui.element).includes('<script>'));assert.match(text(ui.element),/尚無可對照資料/);
});
