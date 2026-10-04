import test from 'node:test';
import assert from 'node:assert/strict';
import {createInvestigationBoard} from '../court/investigation-board.js';
import {newInvestigation,investigationBoard,investigationDebrief} from '../src/court-investigation.ts';
class Element{
 constructor(tag){this.tag=tag;this.textContent='';this.children=[];}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}
}
const text=n=>[n.textContent,...n.children.map(text)].join(' ');
test('board renders server discoveries as text, debrief is read-only and clearing removes private content',()=>{
 const elements=[],document={createElement(tag){const e=new Element(tag);elements.push(e);return e;}};
 const ui=createInvestigationBoard(document),s=newInvestigation();
 ui.render(investigationBoard(s));assert(!text(ui.element).includes('走廊影像'));assert(text(ui.element).includes('尚無紀錄'));
 const board={...investigationBoard(s),completed:true,debrief:investigationDebrief(s,'<img onerror=alert(1)>')};
 ui.render(board);assert(text(ui.element).includes('庭後回顧'));assert(text(ui.element).includes('<img onerror=alert(1)>'));
 assert(elements.every(e=>!Object.hasOwn(e,'innerHTML')));assert(!elements.some(e=>['img','button','input'].includes(e.tag)));
 ui.render(null);assert(ui.element.hidden);assert.equal(text(ui.element),'');
});

test('challenge hides contradiction target/count without changing findings, judgment or scores',()=>{
 const ui=createInvestigationBoard({createElement:tag=>new Element(tag)}),s=newInvestigation();
 const board={...investigationBoard(s),completed:true,debrief:investigationDebrief(s,'使用者的最終判讀')};
 const original=structuredClone(board);
 ui.render(board,'challenge');assert(!text(ui.element).includes('發現矛盾 0 項'));
 assert(!text(ui.element).includes('找出陳述與證物的矛盾'));
 assert(text(ui.element).includes('使用者的最終判讀'));
 ui.render(board,'normal');assert(text(ui.element).includes('發現矛盾 0 項'));
 assert.deepEqual(board,original);
});
