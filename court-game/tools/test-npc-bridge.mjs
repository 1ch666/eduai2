import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const code=readFileSync(new URL('../Assets/Plugins/NpcDialogue.jslib',import.meta.url),'utf8');
function setup(visible=true){
 const controls={hidden:!visible}, listeners=new Map(),calls=[];
 const vv={height:500,offsetTop:0,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
 const library={};let unlocks=0;
 const context={LibraryManager:{library},mergeInto:Object.assign,window:{visualViewport:vv},
  document:{getElementById:()=>controls,pointerLockElement:{},exitPointerLock:()=>unlocks++,querySelector:()=>({getBoundingClientRect:()=>({bottom:800,height:800})})},
  Module:{SendMessage:(...args)=>calls.push(args)}};
 vm.runInNewContext(code,context);
 return {modal:library.CourtDialogueModal,controls,listeners,calls,vv,get unlocks(){return unlocks;}};
}
test('opening native dialogue hides mobile controls and releases pointer lock',()=>{
 const s=setup();s.modal(1);assert.equal(s.controls.hidden,true);assert.equal(s.unlocks,1);
});
test('keyboard inset is bounded and sent only to native dialogue presentation',()=>{
 const s=setup();s.modal(1);s.listeners.get('resize')();
 assert.deepEqual(s.calls[0],['NpcDialogue','SetKeyboardInset','0.375']);
 s.vv.height=0;s.listeners.get('resize')();assert.equal(s.calls[1][2],'0.65');
 s.vv.height=1000;s.listeners.get('resize')();assert.equal(s.calls[2][2],'0');
});
test('closing restores mobile controls and removes keyboard resize listener',()=>{
 const s=setup();s.modal(1);s.modal(0);assert.equal(s.controls.hidden,false);assert.equal(s.listeners.size,0);
});
test('desktop/hidden touch controls remain hidden after closing',()=>{
 const s=setup(false);s.modal(1);s.modal(0);assert.equal(s.controls.hidden,true);
});
