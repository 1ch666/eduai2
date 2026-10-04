import test from 'node:test';
import assert from 'node:assert/strict';
import {createEducationHost} from '../court/education-host.js';
import {newEducationFlow,educationFlowView} from '../src/court-education-flow.ts';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.events={};this.textContent='';}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
 setAttribute(){}addEventListener(k,fn){this.events[k]=fn;}click(){this.events.click?.();}
}
const nodes=n=>[n,...n.children.flatMap(nodes)];
const text=n=>nodes(n).map(e=>e.textContent).join(' ');
const response=data=>Response.json({ok:true,apiVersion:2,requestId:crypto.randomUUID(),traceId:'a'.repeat(32),timestamp:new Date().toISOString(),errorCode:null,stateVersion:null,data});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(fetchImpl){let context={owner:'one',sessionId:crypto.randomUUID(),supported:true};const host=createEducationHost({document:{createElement:t=>new Element(t)},origin:'https://example.test',getContext:()=>context,csrf:()=> 'csrf',fetchImpl});return {host,setContext:c=>context=c};}
test('host makes no collection request on sync; optional status lookup respects disabled backend',async()=>{
 let calls=0;const {host}=fixture(async(_u,o)=>{calls++;assert.equal(o.method,'GET');return response({code:'DISABLED'});});
 host.sync();assert.equal(calls,0);assert.equal(host.element.hidden,false);
 nodes(host.element).find(n=>n.textContent==='查看測驗狀態').click();await settle();assert.equal(calls,1);
 assert.match(text(host.element),/目前未開放/);assert(!nodes(host.element).some(n=>n.type==='checkbox'));
});
test('late responses after owner change never render previous account form',async()=>{
 let resolve;const {host,setContext}=fixture(()=>new Promise(r=>resolve=r));host.sync();
 nodes(host.element).find(n=>n.textContent==='查看測驗狀態').click();
 setContext({owner:'two',sessionId:crypto.randomUUID(),supported:true});host.sync();resolve(response({view:educationFlowView(newEducationFlow())}));await settle();
 assert(!nodes(host.element).some(n=>n.type==='checkbox'));assert.match(text(host.element),/先查看伺服器/);
 setContext(null);host.sync();assert.equal(host.element.hidden,true);assert(!text(host.element).includes('同意並開始'));
});

test('same-session refresh recovers from disabled without automatic consent or writes',async()=>{
 let mode='disabled',posts=0;
 const {host}=fixture(async(_u,o)=>{
  if(o.method!=='GET'){posts++;throw Error('must not auto-submit');}
  if(mode==='offline')throw Error('offline');
  return response(mode==='disabled'?{code:'DISABLED'}:{view:educationFlowView(newEducationFlow())});
 });
 host.sync();const refresh=nodes(host.element).find(n=>n.textContent==='查看測驗狀態');
 refresh.click();await settle();assert.match(text(host.element),/尚未開放/);
 mode='offline';refresh.click();await settle();assert(!nodes(host.element).some(n=>n.type==='checkbox'));
 mode='enabled';refresh.click();await settle();
 const consent=nodes(host.element).find(n=>n.type==='checkbox');
 assert(consent);assert.equal(consent.disabled,false);assert.notEqual(consent.checked,true);
 assert.equal(nodes(host.element).find(n=>n.textContent==='同意並開始前測').disabled,false);
 assert(!text(host.element).includes('目前停止收集'));assert.equal(posts,0);
 mode='disabled';refresh.click();await settle();assert(!nodes(host.element).some(n=>n.type==='checkbox'));assert.equal(posts,0);
});
test('host presents explicit consent and pending retry without automatically resending',async()=>{
 let posts=0;const {host}=fixture(async(_u,o)=>{if(o.method==='GET')return response({view:educationFlowView(newEducationFlow())});posts++;throw Error('lost');});host.sync();
 nodes(host.element).find(n=>n.textContent==='查看測驗狀態').click();await settle();
 const checkbox=nodes(host.element).find(n=>n.type==='checkbox');checkbox.checked=true;
 nodes(host.element).find(n=>n.tag==='form').events.submit({preventDefault(){}});await settle();
 assert.equal(posts,1);assert.equal(nodes(host.element).find(n=>n.textContent==='重送同一筆測驗').hidden,false);
 assert(nodes(host.element).find(n=>n.type==='checkbox').disabled);host.clear();assert.equal(host.element.hidden,true);
});
