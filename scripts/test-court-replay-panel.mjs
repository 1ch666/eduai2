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
 const future=structuredClone(event);future.kind='statement';future.roleId='witness';future.stateVersion=future.eventSequence=1;future.eventId=crypto.randomUUID();
 Object.assign(future.snapshot,{stateVersion:1,eventSequence:1,eventId:future.eventId});
 future.evidenceIds=['receipt'];
 const old=globalThis.fetch;let calls=0,before=0;
 globalThis.fetch=async(url,o)=>{calls++;assert.equal(o.method,'GET');return Response.json({events:[event,future],nextAfter:1,currentVersion:1});};
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
  const roleLabel=elements.find(e=>e.tag==='label'&&e.textContent==='發言角色'),role=roleLabel.children[0];
  assert.equal(role.tag,'select');assert.deepEqual(role.children.map(e=>e.textContent),['全部','法官']);
  role.value='judge';role.fire('change');assert.equal(transcript.children.length,1);
  const evidence=elements.find(e=>e.tag==='label'&&e.textContent==='關聯證物').children[0];
  assert.deepEqual(evidence.children.map(e=>e.value),[''],'future evidence is not offered');
  elements.find(e=>e.textContent==='下一筆').fire('click');
  assert.deepEqual(role.children.map(e=>e.textContent),['全部','法官','證人']);
  assert.deepEqual(evidence.children.map(e=>e.textContent),['全部','虛構收據']);
  evidence.value='receipt';evidence.fire('change');
  elements.find(e=>e.textContent==='上一筆').fire('click');
  assert.deepEqual(evidence.children.map(e=>e.value),['']);assert.equal(evidence.value,'');
  assert.deepEqual(role.children.map(e=>e.textContent),['全部','法官']);
  const jump=row.children.find(e=>e.tag==='button');assert.ok(jump);jump.fire('click');
  assert.equal(calls,1,'jumping in replay must not issue a mutation or new request');
  const search=elements.filter(e=>e.tag==='input')[1];search.value='不存在的內容';search.fire('input');
  assert.equal(transcript.children[0].textContent,'目前播放位置之前，沒有符合篩選的紀錄。');
  assert.ok(elements.every(e=>!Object.hasOwn(e,'innerHTML')));
  panel.clear();await new Promise(r=>setTimeout(r,0));assert.equal(dialog.open,false);assert.equal(section.children.length,0);
  assert.deepEqual(role.children.map(e=>e.textContent),['全部']);assert.equal(role.disabled,true);
 }finally{globalThis.fetch=old;}
});
