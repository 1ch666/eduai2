import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { installGamePanels } from '../../court/game-panels.js';

test('host panels validate sender, reuse live controls, restore nodes, and do not submit actions',async()=>{
 const nodes={};let handler,closed=0;
 class Element {
  constructor(id){this.id=id;this.children=[];this.events={};}
  append(...items){for(const x of items){x.remove();x.parent=this;this.children.push(x);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
  before(x){const p=this.parent;x.parent=p;p.children.splice(p.children.indexOf(this),0,x);}
  replaceWith(x){const p=this.parent,at=p.children.indexOf(this);x.remove();p.children[at]=x;x.parent=p;this.parent=null;}
  addEventListener(name,fn){this.events[name]=fn;}
  setAttribute(){} focus(){} showModal(){this.open=true;} close(){this.open=false;this.events.close?.();}
 }
 const body=new Element('body'),home=new Element('home');body.append(home);
 for(const id of ['scene','evidence','turn-title','turn-help','actions','speech-form','observer','feedback','assessment','logout','back']){nodes[id]=new Element(id);home.append(nodes[id]);}
 const original=home.children.slice();nodes.scene.contentWindow={};
 const document={body,getElementById:id=>nodes[id],createElement:tag=>new Element(tag),createComment:()=>new Element('marker')};
 const window={location:{origin:'https://local.test'},addEventListener:(n,f)=>{if(n==='message')handler=f;}};
 installGamePanels({window,document,getView:()=>({id:'case'}),getAccount:()=>({id:'owner'}),onClose:()=>closed++});
 const event={origin:window.location.origin,source:nodes.scene.contentWindow,data:{type:'court-panel',panel:'evidence'}};
 await handler({...event,origin:'https://evil.test'});assert.equal(body.children.length,1);
 await handler({...event,source:{}});assert.equal(body.children.length,1);
 await handler({...event,data:{type:'court-panel',panel:'delete'}});assert.equal(body.children.length,1);
 await handler(event);let dialog=body.children.at(-1);assert.ok(dialog.open);assert.equal(nodes.evidence.parent,dialog);
 dialog.close();assert.deepEqual(home.children,original);assert.equal(closed,1);
 await handler({...event,data:{type:'court-panel',panel:'actions'}});dialog=body.children.at(-1);
 assert.equal(nodes.actions.parent,dialog);assert.equal(nodes.speech_form,undefined);
 nodes.logout.events.click();assert.deepEqual(home.children,original);assert.equal(closed,2);
});

test('Unity bridge sends only supported panel requests to the same origin',async()=>{
 let library;const sent=[];
 const window={parent:{postMessage:(...args)=>sent.push(args)}};
 vm.runInNewContext(await readFile('court-game/Assets/Plugins/TouchControls.jslib','utf8'),{
  LibraryManager:{library:{}},mergeInto:(_,v)=>library=v,UTF8ToString:v=>v,window,document:{},location:{origin:'https://local.test'},Promise,
 });
 library.CourtHostPanel('evidence');library.CourtHostPanel('actions');library.CourtHostPanel('delete');
 assert.equal(sent.length,2);assert.equal(sent[0][0].panel,'evidence');assert.equal(sent[1][1],'https://local.test');
});
