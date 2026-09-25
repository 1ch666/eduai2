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

function inputSetup(){
 const library={},calls=[],listeners={};let removed=false;
 const element={style:{},value:'',setAttribute(){},addEventListener:(n,f)=>listeners[n]=f,remove(){removed=true;}};
 const window={};
 vm.runInNewContext(code,{LibraryManager:{library},mergeInto:Object.assign,window,UTF8ToString:v=>v,
  document:{createElement:()=>element,body:{appendChild(){}},querySelector:()=>({getBoundingClientRect:()=>({left:10,top:20,width:800,height:600})})},
  Module:{SendMessage:(...a)=>calls.push(a)}});
 return {library,element,listeners,calls,window,get removed(){return removed;}};
}
test('Chinese composition stays in native input until committed',()=>{
 const s=inputSetup();s.library.CourtInputRect(.1,.2,.5,.1,'',1);
 s.listeners.compositionstart();s.element.value='法庭中文';s.listeners.input();
 s.library.CourtInputRect(.1,.2,.5,.1,'',1);
 assert.equal(s.element.value,'法庭中文');assert.equal(s.calls.length,1);
 s.listeners.compositionend();
 assert.deepEqual(s.calls.slice(1),[['NpcDialogue','SetBrowserText','法庭中文'],['NpcDialogue','SetComposition','0']]);
});
test('native input is positioned, bounded, isolated and removed on close',()=>{
 const s=inputSetup();s.library.CourtInputRect(.1,.2,.5,.1,'',1);
 assert.equal(s.element.style.left,'90px');assert.equal(s.element.style.width,'400px');
 s.element.value='中'.repeat(450);s.listeners.input();assert.equal(s.element.value.length,400);
 let stopped=false;s.listeners.keydown({stopPropagation(){stopped=true;}});assert.ok(stopped);
 s.library.CourtInputRect(.1,.2,.5,.1,'新問題',0);assert.equal(s.element.value,'新問題');assert.ok(s.element.disabled);
 s.library.CourtInputHide();assert.ok(s.removed);assert.equal(s.window.courtInput,null);
});
