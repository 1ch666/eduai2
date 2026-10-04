import test from 'node:test';
import assert from 'node:assert/strict';
import {CourtEducationClient,validEducationView} from '../court/education-client.js';
import {newEducationFlow,educationFlowView,transitionEducationFlow} from '../src/court-education-flow.ts';
const off=()=>educationFlowView(newEducationFlow());
const pre=()=>educationFlowView(transitionEducationFlow(newEducationFlow(),{kind:'consent'},0,'not_started'));
const response=data=>Response.json({ok:true,apiVersion:2,requestId:crypto.randomUUID(),traceId:'a'.repeat(32),timestamp:new Date().toISOString(),errorCode:null,stateVersion:null,data});
function client(fetchImpl,timeoutMs=1000){const c=new CourtEducationClient({origin:'https://example.test',csrf:()=> 'csrf',fetchImpl,timeoutMs});c.bind(crypto.randomUUID());return c;}

test('fetch is invoked without the client as a browser WebIDL receiver',async()=>{
 const c=client(function(){assert.equal(this,undefined,'native fetch rejects a CourtEducationClient receiver');return Promise.resolve(response({view:off()}));});
 assert.equal(await c.refresh(),'accepted');assert.equal(c.view.phase,'off');
});
test('unknown POST stays pending; explicit retry preserves exact ID/body without storing credentials',async()=>{
 const calls=[];let fail=true;
 const c=client(async(url,o)=>{calls.push({url,...o});if(o.method==='GET')return response({view:off()});if(fail)throw Error('lost');return response({code:'ACCEPTED',appliedRevision:1,view:pre()});});
 assert.equal(await c.refresh(),'accepted');assert.equal(await c.submit({kind:'consent'},0),'unavailable');assert.equal(c.pending,true);
 assert.equal(await c.submit({kind:'consent'},0),'pending');await c.refresh();assert.equal(c.pending,true);
 fail=false;assert.equal(await c.retry(),'accepted');assert.equal(c.pending,false);
 const posts=calls.filter(c=>c.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0].body,posts[1].body);
 assert.equal(posts[0].credentials,'same-origin');assert.equal(posts[0].headers['X-CSRF-Token'],'csrf');assert(!posts[0].body.includes('csrf'));
 const detached=c.view;detached.phase='off';assert.equal(c.view.phase,'pre');
});
test('clearing/rebinding rejects late replies; timeout does not automatically repeat writes',async()=>{
 let resolve;const c=client(()=>new Promise(r=>resolve=r));const pending=c.refresh();c.bind(crypto.randomUUID());resolve(response({view:pre()}));assert.equal(await pending,'obsolete-context');assert.equal(c.view,null);
 let calls=0;const timeout=client(async()=>{calls++;return new Promise(()=>{});},5);assert.equal(await timeout.refresh(),'timeout');assert.equal(calls,1);assert.equal(timeout.busy,false);
});

test('definitive POST conflict requires refresh, not endless replay of a refused command',async()=>{
 const posts=[];
 const c=client(async(_url,o)=>{if(o.method==='GET')return response({view:off()});posts.push(o.body);return new Response(null,{status:409});});
 await c.refresh();assert.equal(await c.submit({kind:'consent'},0),'conflict');
 assert.equal(c.pending,false);assert.equal(c.view,null);assert.equal(await c.retry(),'no-pending');
 assert.equal(await c.submit({kind:'consent'},0),'refresh-required');assert.equal(posts.length,1);
 await c.refresh();assert.equal(await c.submit({kind:'consent'},0),'conflict');
 assert.equal(posts.length,2);assert.notEqual(JSON.parse(posts[0]).requestId,JSON.parse(posts[1]).requestId);
});
test('response validation blocks premature scores, unknown private fields and oversized payloads',async()=>{
 assert.equal(validEducationView(off()),true);assert.equal(validEducationView(pre()),true);
 assert.equal(validEducationView({...pre(),results:{pre:{score:3,total:3},post:{score:3,total:3}}}),false);
 assert.equal(validEducationView({...pre(),answerKey:[1,2,0]}),false);
 const c=client(async()=>response({view:{...pre(),questions:[{...pre().questions[0],correct:1},...pre().questions.slice(1)]}}));assert.equal(await c.refresh(),'unavailable');assert.equal(c.view,null);
 const huge=client(async()=>new Response(' '.repeat(32769)));assert.equal(await huge.refresh(),'unavailable');
});
test('withdrawal locks the local view; login loss clears private state',async()=>{
 let status=200,data={view:pre()};const c=client(async()=>status===200?response(data):new Response(null,{status}));
 await c.refresh();data={code:'WITHDRAWN'};assert.equal(await c.withdraw(),'accepted');assert.equal(c.view.phase,'withdrawn');
 data={view:pre()};assert.equal(await c.refresh(),'stale');assert.equal(c.view.phase,'withdrawn');
 status=401;assert.equal(await c.refresh(),'login-required');assert.equal(c.view,null);
});
