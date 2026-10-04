import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneView} from '../court/scene-view.js';
function setup(){
 const sent=[],target={postMessage:(...args)=>sent.push(args)};
 let frame={hidden:false,contentWindow:target},view={id:'one',version:0,config:{role:'judge'},procedure:'criminal'};
 const camera=createSceneView({getFrame:()=>frame,getView:()=>view,origin:'https://court.test'});
 return {camera,sent,get frame(){return frame;},set frame(v){frame=v;},get view(){return view;},set view(v){view=v;}};
}
test('ordinary authoritative updates do not teleport the player or steal focus',()=>{
 const p=setup();assert.equal(p.camera.send('walk'),true);
 for(let version=1;version<=13;version++){
  p.view={...p.view,version,completed:version===13};assert.equal(p.camera.send('walk'),false);
 }
 assert.equal(p.sent.length,1);assert.equal(p.sent[0][0].focus,false);
 assert.equal(p.sent[0][1],'https://court.test');
});
test('explicit camera choice, changed session/role/procedure and Unity ready reapply placement',()=>{
 const p=setup();p.camera.send('walk');
 assert.equal(p.camera.send('walk',true),true);assert.equal(p.sent.at(-1)[0].focus,true);
 assert.equal(p.camera.send('seat'),true);
 p.view={...p.view,id:'two'};assert.equal(p.camera.send('seat'),true);
 p.view={...p.view,config:{role:'respondent'}};assert.equal(p.camera.send('seat'),true);
 p.view={...p.view,procedure:'civil'};assert.equal(p.camera.send('seat'),true);
 p.camera.clear();assert.equal(p.camera.send('seat'),true);
 assert.equal(p.camera.send('seat'),false);
});
test('hidden, absent or unbound frames never consume the next placement; new windows initialize',()=>{
 const p=setup();p.frame.hidden=true;assert.equal(p.camera.send('walk'),false);
 p.frame.hidden=false;assert.equal(p.camera.send('walk'),true);
 const view=p.view;p.view=null;assert.equal(p.camera.send('overview'),false);p.view=view;
 assert.equal(p.camera.send('overview'),true);
 p.frame={hidden:false,contentWindow:{postMessage:(...args)=>p.sent.push(args)}};
 assert.equal(p.camera.send('overview'),true);assert.equal(p.camera.send('execute'),false);
});
