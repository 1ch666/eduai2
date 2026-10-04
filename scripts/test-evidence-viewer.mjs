import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEvidenceViewer} from '../court/evidence-viewer.js';

const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
class Element{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.value='';this.children=[];this.listeners={};}
 append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
 setAttribute(){} addEventListener(name,fn){this.listeners[name]=fn;} fire(name){this.listeners[name]?.();}
}
function setup(){
 const elements=[],document={createElement(tag){const e=new Element(tag);elements.push(e);return e;},createTextNode(text){return new Element('#text',text);}};
 const links=[],viewer=createEvidenceViewer({document,onTranscript:id=>links.push(id)});
 return {elements,links,viewer};
}
const textOf=node=>[node.textContent,...node.children.map(textOf)].join(' ');
const snapshot=()=>{
 const s=structuredClone(fixture);
 s.state.evidence=[{evidenceId:'receipt',title:'匯款紀錄',type:'document',text:'<script>不可執行</script> 已付款',metadata:[{name:'來源',value:'虛構教學資料'}],sourceRole:'court',admittedStatus:'notConsidered',presentationState:'available',factReferences:[],assetId:''},
  {evidenceId:'chat',title:'交易對話',type:'chat',text:'尚無物流編號',metadata:[],sourceRole:'court',admittedStatus:'notConsidered',presentationState:'available',factReferences:[],assetId:''}];
 return s;
};
test('comparison uses visible evidence and treats content and highlighting as text',()=>{
 const {viewer,elements,links}=setup();viewer.setSnapshot(snapshot());
 assert.deepEqual(elements.filter(e=>e.tag==='select').map(e=>e.value),['receipt','chat']);
 assert.ok(textOf(viewer.element).includes('<script>不可執行</script>'));
 const search=elements.find(e=>e.tag==='input');search.value='<script>';search.fire('input');
 assert.ok(elements.some(e=>e.tag==='mark'&&e.textContent==='<script>'));
 assert.ok(elements.every(e=>!Object.hasOwn(e,'innerHTML')));
 const articles=elements.filter(e=>e.tag==='article');articles[0].children.find(e=>e.tag==='button').fire('click');
 assert.deepEqual(links,['receipt']);
});
test('historical change removes now-unavailable selection and malformed input clears data',()=>{
 const {viewer,elements}=setup(),s=snapshot();viewer.setSnapshot(s);
 s.stateVersion++;s.eventSequence++;s.eventId=crypto.randomUUID();s.state.evidence=s.state.evidence.slice(1);
 viewer.setSnapshot(s);
 assert.deepEqual(elements.filter(e=>e.tag==='select').map(e=>e.value),['chat','chat']);
 assert.ok(!textOf(viewer.element).includes('匯款紀錄'));
 viewer.setSnapshot({...s,hiddenTruth:'must not render'});
 assert.ok(!textOf(viewer.element).includes('交易對話'));
 assert.equal(viewer.element.open,false);
});
test('switching session clears query, closure clears evidence and never loads asset URLs',()=>{
 const {viewer,elements}=setup(),s=snapshot();s.state.evidence[0].assetId='synthetic-image';viewer.setSnapshot(s);
 const search=elements.find(e=>e.tag==='input');search.value='私人關鍵字';
 s.sessionId=crypto.randomUUID();viewer.setSnapshot(s);assert.equal(search.value,'');
 assert.ok(textOf(viewer.element).includes('未載入圖片'));
 assert.ok(elements.every(e=>e.tag!=='img'&&e.tag!=='iframe'&&e.tag!=='script'));
 viewer.clear();assert.ok(!textOf(viewer.element).includes('交易對話'));
});
test('detached transcript controls cannot restore future or cleared evidence',()=>{
 const {viewer,elements,links}=setup(),s=snapshot();viewer.setSnapshot(s);
 const old=elements.filter(e=>e.tag==='article')[0].children.find(e=>e.tag==='button');
 const earlier=structuredClone(s);earlier.state.evidence=[];earlier.eventId=crypto.randomUUID();viewer.setSnapshot(earlier);
 old.fire('click');assert.deepEqual(links,[]);
 viewer.setSnapshot(s);const current=elements.filter(e=>e.tag==='article')[0].children.find(e=>e.tag==='button');
 current.fire('click');assert.deepEqual(links,['receipt']);viewer.clear();current.fire('click');assert.deepEqual(links,['receipt']);
});
