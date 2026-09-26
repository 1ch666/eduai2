import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../Assets/WebGLTemplates/Court/index.html',import.meta.url),'utf8').match(/<script data-fullscreen>([\s\S]*?)<\/script>/)[1];
function page(supported=true){const button={},events={},classes=new Set();let entered=0,exited=0;const document={getElementById:()=>button,documentElement:supported?{requestFullscreen:async()=>entered++}:{},exitFullscreen:async()=>exited++,addEventListener:(k,f)=>events[k]=f,body:{classList:{toggle:k=>classes.has(k)?classes.delete(k):classes.add(k),contains:k=>classes.has(k)}}};const window={};window.parent=window;vm.runInNewContext(code,{document,window});return {button,document,events,get entered(){return entered;},get exited(){return exited;}};}
test('fullscreen only on user click, exits and updates label',async()=>{const p=page();assert.equal(p.entered,0);await p.button.onclick();assert.equal(p.entered,1);p.document.fullscreenElement={};p.events.fullscreenchange();assert.equal(p.button.textContent,'退出全螢幕');await p.button.onclick();assert.equal(p.exited,1);});
test('unsupported browsers have expandable layout, not a fake fullscreen claim',async()=>{const p=page(false);assert.equal(p.button.textContent,'展開畫面');await p.button.onclick();assert.equal(p.button.textContent,'還原畫面');await p.button.onclick();assert.equal(p.button.textContent,'展開畫面');});
