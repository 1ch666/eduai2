import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installActionPanel} from '../court/action-panel.js';
import {createPendingJournal} from '../court/pending-journal.js';
const fixture=JSON.parse(await readFile(new URL('../court-game/Assets/Editor/Fixtures/court-v1.json',import.meta.url),'utf8'));
// Minimal DOM lifecycle adapter, not a browser visual or keyboard test.
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.style={};this.value='';this.open=false;}
 get options(){return this.children;}
 setAttribute(k,v){(this.attributes??={})[k]=v;} append(...nodes){this.children.push(...nodes);} after(node){this.afterNode=node;}
 replaceChildren(...nodes){this.children=nodes;} addEventListener(k,f){(this.listeners[k]??=[]).push(f);}
 fire(k){for(const f of this.listeners[k]||[])f();}
 showModal(){this.open=true;} close(){this.open=false;this.fire('close');}
}
test('restored pending marker shows recovery outside closed dialog and resolves with GET only',async()=>{
 const elements=[],document=new Element('document'),anchor=new Element('notice');document.body=new Element('body');
 document.getElementById=id=>id==='notice'?anchor:null;
 document.createElement=tag=>{const e=new Element(tag);elements.push(e);return e;};
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const window=new Element('window');Object.assign(window,{location:{origin:'https://court.test'},sessionStorage:storage});
 const requestId=crypto.randomUUID(),scope={sessionId:fixture.sessionId,caseId:fixture.caseId};
 createPendingJournal({getStorage:()=>storage,getOwner:()=> 'owner'})(scope).save(requestId);
 const snapshot={...structuredClone(fixture),requestId,stateVersion:1,eventSequence:1,eventId:crypto.randomUUID()};
 snapshot.state.feedback='測試系統提示';
 const {state,...envelope}=snapshot,event={...envelope,kind:'npc_utterance',speaker:'證人',roleId:'witness',stageId:state.stageId,text:'測試系統提示',evidenceIds:[],citationIds:[],snapshot};
 const old=globalThis.fetch,calls=[];let updated=0,before=0;
 globalThis.fetch=async(url,o)=>{calls.push([url,o.method]);return Response.json(event);};
 try{
  const panel=installActionPanel({document,window,getView:()=>({id:scope.sessionId,config:{caseId:scope.caseId}}),getAccount:()=>({id:'owner'}),csrf:()=> 'local-test',beforeOpen:()=>before++,onUpdated:async()=>updated++});
  panel.resume();const banner=anchor.afterNode,dialog=elements.find(e=>e.tag==='dialog');
  assert.equal(dialog.open,false);assert.equal(banner.hidden,false);assert.equal(panel.pending,true);assert.equal(calls.length,0);
  banner.children.find(e=>e.tag==='button').fire('click');assert.equal(dialog.open,true);assert.equal(before,1);assert.equal(calls.length,0);
  const recover=elements.find(e=>e.textContent==='查詢上次送出結果');recover.onclick();
  for(let i=0;i<50&&panel.working;i++)await new Promise(r=>setTimeout(r,2));
  assert.equal(panel.working,false);assert.equal(panel.pending,false);assert.equal(banner.hidden,true);assert.equal(updated,1);assert.equal(values.size,0);
  const dialogue=elements.find(e=>e.style.whiteSpace==='pre-wrap');
  assert.equal(dialogue.textContent,'證人：測試系統提示','same NPC reply and feedback must appear once');
  const body=elements.find(e=>e.children.some(child=>child.tag==='label'&&child.textContent==='陳述或提問（角色提問最多 400 字）'));
  const board=dialog.children.find(e=>e.attributes?.['aria-label']==='案件筆記');
  assert.ok(dialog.children.indexOf(body)<dialog.children.lastIndexOf(board),'procedure controls precede the notebook');
  assert.deepEqual(calls,[[`https://court.test/api/court/v1/sessions/${scope.sessionId}/requests/${requestId}`,'GET']]);
  panel.clear();assert.equal(dialog.open,false);assert.equal(banner.hidden,true);
 }finally{globalThis.fetch=old;}
});

test('in-game panel comparison uses the same-version board and clears on context replacement',async()=>{
 const elements=[],document=new Element('document');document.body=new Element('body');
 document.getElementById=()=>null;document.createElement=tag=>{const e=new Element(tag);elements.push(e);return e;};
 const values=new Map(),window=new Element('window');
 Object.assign(window,{location:{origin:'https://court.test'},sessionStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}});
 const board={completed:false,objectives:[],questionedNpcIds:['Witness'],evidence:[{id:'visible',title:'VISIBLE-EVIDENCE',text:'VISIBLE-TEXT'}],statements:[{npcId:'Witness',text:'HEARD-STATEMENT'}],contradictions:[]};
 let view={id:fixture.sessionId,version:fixture.stateVersion,config:{caseId:fixture.caseId},investigation:board};
 let account={id:'first-owner'};const calls=[],old=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{calls.push(options?.method||'GET');return Response.json({...structuredClone(fixture),requestId:new URL(url).searchParams.get('requestId')});};
 const walk=e=>[e,...e.children.flatMap(walk)];
 const text=e=>walk(e).map(n=>n.textContent||'').join('\n');
 async function settled(panel){for(let i=0;i<100&&panel.working;i++)await new Promise(r=>setTimeout(r,2));assert.equal(panel.working,false);}
 try{
  const panel=installActionPanel({document,window,getView:()=>view,getAccount:()=>account,csrf:()=>'',beforeOpen:()=>{},onUpdated:async()=>{}});
  panel.open();await settled(panel);
  const dialog=elements.find(e=>e.tag==='dialog');
  assert.match(text(dialog),/陳述與證物對照/);assert.match(text(dialog),/HEARD-STATEMENT/);
  assert.match(text(dialog),/VISIBLE-EVIDENCE/);
  const refresh=elements.find(e=>e.textContent==='更新狀態');
  view={...view,version:fixture.stateVersion+1};refresh.onclick();await settled(panel);
  assert(!text(dialog).includes('HEARD-STATEMENT'),'do not combine a different-version board with action state');
  view={...view,version:fixture.stateVersion};refresh.onclick();await settled(panel);
  assert.match(text(dialog),/HEARD-STATEMENT/);
  const previousView=view;view={...view,id:crypto.randomUUID()};panel.resume();
  assert(!text(dialog).includes('HEARD-STATEMENT'),'switching sessions clears the earlier notebook before a new response');
  view=previousView;panel.open();await settled(panel);assert.match(text(dialog),/HEARD-STATEMENT/);
  account={id:'second-owner'};panel.resume();
  assert(!text(dialog).includes('HEARD-STATEMENT'));assert(!text(dialog).includes('VISIBLE-EVIDENCE'));
  assert.equal(dialog.open,false);panel.clear();assert(calls.every(method=>method==='GET'));
 }finally{globalThis.fetch=old;}
});
