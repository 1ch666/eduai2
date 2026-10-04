import test from 'node:test';
import assert from 'node:assert/strict';
import {completedQuestions,createQuestionReview} from '../court/question-review.js';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.value='';}
 setAttribute(){} append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}
 addEventListener(n,f){this.listeners[n]=f;}fire(n){this.listeners[n]?.();}
}
const record=(patch={})=>({requestId:crypto.randomUUID(),npcId:'Witness',version:3,question:'你看到了什麼？',text:'我記得是在晚上。',mode:'ai',knowledgeIds:['private-marker'],...patch});
const view=(rows)=>({id:'session-a',version:8,completed:true,npcs:[{id:'Witness',name:'證人'},{id:'Defense',name:'辯護人'}],npcHistory:rows});
test('completed question projection is bounded, deduplicated and excludes private/unmeasured metadata',()=>{
 const a=record(),v=view([a,a,record({version:9}),record({mode:'unknown'}),record({npcId:'Hidden'}),record({question:'x'.repeat(401)}),record({text:'x'.repeat(12001)})]);
 const before=structuredClone(v),rows=completedQuestions(v);assert.equal(rows.length,1);
 assert.deepEqual(Object.keys(rows[0]).sort(),['dictionary','mode','name','npcId','question','text'].sort());
 assert.deepEqual(v,before);assert.deepEqual(completedQuestions({...v,completed:false}),[]);
 assert.deepEqual(completedQuestions(null),[]);assert.equal(completedQuestions(view(Array.from({length:205},()=>record()))).length,200);
});
test('question review renders literal text, honest modes, filtering, pagination and clearing',()=>{
 const elements=[],document={createElement(tag){const e=new Element(tag);elements.push(e);return e;}};
 const panel=createQuestionReview(document),rows=Array.from({length:23},(_,i)=>record({question:`題 ${i}`,text:i===0?'<img src=x onerror=alert(1)>':'一般回覆'}));
 rows[1]=record({question:'你好',npcId:'Defense',mode:'scripted'});rows[2]=record({question:'民主',mode:'scripted',errorCode:'DICTIONARY'});
 panel.setView(view(rows));assert.equal(panel.element.hidden,false);
 const list=elements.find(e=>e.tag==='ol');assert.equal(list.children.length,20);
 assert.equal(list.children[0].children[2].textContent,'<img src=x onerror=alert(1)>');
 assert.match(list.children[1].children[1].textContent,/非 AI/);assert.match(list.children[2].children[1].textContent,/辭典/);
 elements.find(e=>e.textContent==='顯示更多問答').fire('click');assert.equal(list.children.length,23);
 const search=elements.find(e=>e.tag==='input');search.value='你好';search.fire('input');assert.equal(list.children.length,1);
 search.value='';search.fire('input');const role=elements.find(e=>e.tag==='select');role.value='Defense';role.fire('change');assert.equal(list.children.length,1);
 panel.setView({...view(rows),id:'session-b',npcHistory:[]});assert.equal(list.children.length,0);assert.equal(search.value,'');assert.equal(role.value,'');
 panel.clear();assert.equal(panel.element.hidden,true);assert.equal(panel.element.open,false);assert.equal(list.children.length,0);
 search.value='題';search.fire('input');assert.equal(list.children.length,0,'stale handlers cannot repopulate private text');
 assert.ok(elements.every(e=>!Object.hasOwn(e,'innerHTML')));
 panel.setView({...view(rows),completed:false});assert.equal(panel.element.hidden,true);
});
test('question controls clear retained text when owner context is no longer valid',()=>{
 let valid=true;const elements=[],document={createElement(tag){const e=new Element(tag);elements.push(e);return e;}};
 const panel=createQuestionReview(document,()=>valid);panel.setView(view([record()]));
 const list=elements.find(e=>e.tag==='ol');assert.equal(list.children.length,1);
 valid=false;elements.find(e=>e.tag==='input').fire('input');
 assert.equal(list.children.length,0);assert.equal(panel.element.hidden,true);
});
