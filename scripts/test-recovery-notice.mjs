import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecoveryNotice} from '../court/recovery-notice.js';
// Minimal text/lifecycle adapter; not a browser rendering/accessibility audit.
function setup(){
 const elements=[];let opened=0;
 const document={createElement:tag=>{
  const e={tag,children:[],listeners:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},append(...nodes){this.children.push(...nodes);},addEventListener(k,v){this.listeners[k]=v;}};
  elements.push(e);return e;
 }};
 const notice=createRecoveryNotice({document,onOpen:()=>opened++});
 return {notice,elements,get opened(){return opened;}};
}
test('pending recovery remains visible outside dialog, without submitting or displaying identifiers',()=>{
 const s=setup(),[root,message,button]=s.elements;
 assert.equal(root.hidden,true);button.listeners.click();assert.equal(s.opened,0);
 s.notice.update({pending:true});assert.equal(root.hidden,false);assert.match(message.textContent,/請勿再次送出/);
 assert.equal(button.disabled,false);assert.equal(button.type,'button');assert.equal(message.attributes.role,'status');
 button.listeners.click();assert.equal(s.opened,1);
 s.notice.update({pending:true,working:true});button.listeners.click();assert.equal(s.opened,1);
 s.notice.update();assert.equal(root.hidden,true);assert.equal(message.textContent,'');
 assert.ok(s.elements.every(e=>!Object.hasOwn(e,'innerHTML')));
});
test('storage failure is distinguished from an unconfirmed request and clears on context reset',()=>{
 const s=setup(),[root,message,button]=s.elements;
 s.notice.update({blocked:true});assert.equal(root.hidden,false);assert.match(message.textContent,/分頁儲存/);
 assert.doesNotMatch(message.textContent,/已保存|已完成/);assert.equal(button.disabled,false);
 s.notice.update({pending:false,blocked:false});assert.equal(root.hidden,true);
});
