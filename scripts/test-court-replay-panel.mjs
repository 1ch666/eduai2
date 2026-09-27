import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installReplayPanel} from '../court/replay-panel.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
// Minimal DOM adapter for lifecycle/text rendering, not a real browser test.
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.value='';this.open=false;}
 setAttribute(){} append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);} fire(name){for(const f of this.listeners[name]||[])f();}
 showModal(){this.open=true;} close(){this.open=false;queueMicrotask(()=>this.fire('close'));}
}
test('panel loads text-only replay and closing clears private text and pending work',async()=>{
 const elements=[],document=new Element('document');document.body=new Element('body');document.createElement=tag=>{const e=new Element(tag);elements.push(e);return e;};
 const window=new Element('window');Object.assign(window,{location:{origin:'https://court.test'},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});
 const snapshot=structuredClone(fixture),{state,...envelope}=snapshot;
 const event={...envelope,kind:'session_started',speaker:'<script>角色</script>',roleId:'judge',stageId:state.stageId,text:'私人測試紀錄',evidenceIds:[],citationIds:[],snapshot};
 const old=globalThis.fetch;let calls=0,before=0;
 globalThis.fetch=async(url,o)=>{calls++;assert.equal(o.method,'GET');return Response.json({events:[event],nextAfter:event.eventSequence,currentVersion:event.stateVersion});};
 try{
  const panel=installReplayPanel({document,window,getView:()=>({id:fixture.sessionId,config:{caseId:fixture.caseId}}),getAccount:()=>({id:'owner'}),beforeOpen:()=>before++});
  panel.open();await new Promise(r=>setTimeout(r,20));
  const dialog=elements.find(e=>e.tag==='dialog'),section=elements.find(e=>e.tag==='section');
  assert.equal(dialog.open,true);assert.equal(before,1);assert.equal(calls,1);
  assert.ok(section.children.some(e=>e.textContent==='私人測試紀錄'));
  const transcript=elements.find(e=>e.tag==='ol');
  const row=transcript.children[0];
  assert.ok(row.children.some(e=>e.textContent===event.timestamp));
  assert.ok(row.children.some(e=>e.textContent.includes('法官')&&e.textContent.includes('建立場次')));
  const jump=row.children.find(e=>e.tag==='button');assert.ok(jump);jump.fire('click');
  assert.equal(calls,1,'jumping in replay must not issue a mutation or new request');
  const search=elements.filter(e=>e.tag==='input')[1];search.value='不存在的內容';search.fire('input');
  assert.equal(transcript.children[0].textContent,'目前播放位置之前，沒有符合篩選的紀錄。');
  assert.ok(elements.every(e=>!Object.hasOwn(e,'innerHTML')));
  panel.clear();await new Promise(r=>setTimeout(r,0));assert.equal(dialog.open,false);assert.equal(section.children.length,0);
 }finally{globalThis.fetch=old;}
});
