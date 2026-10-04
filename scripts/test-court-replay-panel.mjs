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
 const old=globalThis.fetch;let calls=0,before=0,owner='owner';
 globalThis.fetch=async(url,o)=>{calls++;assert.equal(o.method,'GET');return Response.json({events:[event,future],nextAfter:1,currentVersion:1});};
 try{
  const panel=installReplayPanel({document,window,getView:()=>({id:fixture.sessionId,config:{caseId:fixture.caseId},completed:true,version:1,npcs:[{id:'Witness',name:'證人'}],npcHistory:[{requestId:crypto.randomUUID(),npcId:'Witness',version:1,question:'私人提問',text:'私人回覆',mode:'ai'}]}),getAccount:()=>({id:owner}),beforeOpen:()=>before++});
  panel.open();await new Promise(r=>setTimeout(r,20));
  const dialog=elements.find(e=>e.tag==='dialog'),section=elements.find(e=>e.tag==='section');
  assert.equal(dialog.open,true);assert.equal(before,1);assert.equal(calls,1);
  assert.ok(section.children.some(e=>e.textContent==='私人測試紀錄'));
  const questions=elements.find(e=>e.className==='question-review');assert.equal(questions.hidden,false);
  assert.ok(questions.children.find(e=>e.tag==='ol').children[0].children.some(e=>e.textContent==='你：私人提問'));
  const transcript=elements.find(e=>e.tag==='ol');
  const row=transcript.children[0];
  assert.ok(row.children.some(e=>e.textContent===event.timestamp));
  assert.ok(row.children.some(e=>e.textContent.includes('法官')&&e.textContent.includes('建立場次')));
  const roleLabel=elements.find(e=>e.tag==='label'&&e.textContent==='發言角色'),role=roleLabel.children[0];
  assert.equal(role.tag,'select');assert.deepEqual(role.children.map(e=>e.textContent),['全部','法官']);
  role.value='judge';role.fire('change');assert.equal(transcript.children.length,1);
  const evidence=elements.find(e=>e.tag==='label'&&e.textContent==='關聯證物').children[0];
  const kind=elements.find(e=>e.tag==='label'&&e.textContent==='事件類型').children[0];
  assert.deepEqual(kind.children.map(e=>e.textContent),['全部','建立場次']);
  assert.deepEqual(evidence.children.map(e=>e.value),[''],'future evidence is not offered');
  elements.find(e=>e.textContent==='下一筆').fire('click');
  assert.deepEqual(role.children.map(e=>e.textContent),['全部','法官','證人']);
  assert.deepEqual(evidence.children.map(e=>e.textContent),['全部','虛構收據']);
  assert.deepEqual(kind.children.map(e=>e.textContent),['全部','建立場次','陳述']);
  kind.value='statement';kind.fire('change');assert.equal(transcript.children.length,1);
  elements.find(e=>e.textContent==='第一筆').fire('click');assert.equal(kind.value,'');
  assert.deepEqual(kind.children.map(e=>e.textContent),['全部','建立場次']);
  elements.find(e=>e.textContent==='已讀最後一筆').fire('click');assert.equal(calls,1);
  evidence.value='receipt';evidence.fire('change');
  elements.find(e=>e.textContent==='上一筆').fire('click');
  assert.deepEqual(evidence.children.map(e=>e.value),['']);assert.equal(evidence.value,'');
  assert.deepEqual(role.children.map(e=>e.textContent),['全部','法官']);
  const jump=row.children.find(e=>e.tag==='button');assert.ok(jump);jump.fire('click');
  assert.equal(calls,1,'jumping in replay must not issue a mutation or new request');
  const search=elements.find(e=>e.tag==='label'&&e.textContent==='搜尋發言').children[0];search.value='不存在的內容';search.fire('input');
  assert.equal(transcript.children[0].textContent,'目前播放位置之前，沒有符合篩選的紀錄。');
  assert.ok(elements.every(e=>!Object.hasOwn(e,'innerHTML')));
  panel.clear();await new Promise(r=>setTimeout(r,0));assert.equal(dialog.open,false);assert.equal(section.children.length,0);
  assert.deepEqual(role.children.map(e=>e.textContent),['全部']);assert.equal(role.disabled,true);
  assert.equal(questions.hidden,true);assert.equal(questions.children.find(e=>e.tag==='ol').children.length,0);
  panel.open();await new Promise(r=>setTimeout(r,20));assert.equal(dialog.open,true);
  owner='another-owner';elements.find(e=>e.textContent==='已讀最後一筆').fire('click');
  assert.equal(dialog.open,false);assert.equal(section.children.length,0);assert.equal(questions.hidden,true);
  assert.equal(questions.children.find(e=>e.tag==='ol').children.length,0,'changed owner clears completed questions before next animation frame');
 }finally{globalThis.fetch=old;}
});
for(const status of [401,403,404])test(`HTTP ${status} clears replay and completed questions even with stale shell account`,async()=>{
 const elements=[],document=new Element('document');document.body=new Element('body');document.createElement=tag=>{const e=new Element(tag);elements.push(e);return e;};
 const window=new Element('window');Object.assign(window,{location:{origin:'https://court.test'},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});
 const snapshot=structuredClone(fixture),{state,...envelope}=snapshot;
 const event={...envelope,kind:'session_started',speaker:'系統',roleId:'judge',stageId:state.stageId,text:'私人紀錄',evidenceIds:[],citationIds:[],snapshot};
 let calls=0;const old=globalThis.fetch;
 globalThis.fetch=async(_url,options)=>{assert.equal(options.method,'GET');return ++calls===1?Response.json({events:[event],nextAfter:0,currentVersion:0}):Response.json({error:'unavailable'},{status});};
 try{
  const panel=installReplayPanel({document,window,getView:()=>({id:fixture.sessionId,config:{caseId:fixture.caseId},completed:true,version:1,npcs:[{id:'Witness',name:'證人'}],npcHistory:[{requestId:'test-question',npcId:'Witness',version:0,question:'舊帳號提問',text:'舊帳號回答',mode:'ai'}]}),getAccount:()=>({id:'stale-owner'}),beforeOpen(){}});
  panel.open();await new Promise(r=>setTimeout(r,20));
  const questions=elements.find(e=>e.className==='question-review'),list=questions.children.find(e=>e.tag==='ol');assert.equal(list.children.length,1);
  elements.find(e=>e.textContent==='檢查新紀錄').fire('click');await new Promise(r=>setTimeout(r,20));
  assert.equal(questions.hidden,true);assert.equal(list.children.length,0);
  assert.equal(elements.find(e=>e.tag==='section').children.length,0);
  const more=elements.find(e=>e.textContent==='讀取下一頁');assert.equal(more.disabled,true);more.fire('click');
  elements.find(e=>e.textContent==='已讀最後一筆').fire('click');
  assert.equal(list.children.length,0);assert.equal(calls,2,'denied context cannot retry with stale identity');
  assert.ok(elements.some(e=>e.textContent?.includes('已清除本頁紀錄')));
  panel.clear();
 }finally{globalThis.fetch=old;}
});
