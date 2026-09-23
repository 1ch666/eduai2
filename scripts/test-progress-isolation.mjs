import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('    function progressPayload('),html.indexOf('    function openNoteDatabase('));
function setup(){
 const calls=[];
 const c=vm.createContext({authState:{user:{id:'A'}},progressOwner:null,progressReady:false,guestProgress:null,
 civicState:{solved:new Set(['guest']),score:7},dailyState:{solved:new Set(),streak:0},
 clearTimeout,setTimeout,$:()=>null,PROGRESS_API_PATH:'/api/progress',
 apiFetch:async(_url,options)=>{
   calls.push(options);
   return {response:{ok:true},payload:{records:[{scope:'civics',payload:{solved:[c.authState.user.id],score:1}}]}};
 }});
 vm.runInContext(source,c);return {c,calls};
}
test('Guest and previous account progress do not silently transfer to the next account',async()=>{
 const {c,calls}=setup();await c.loadProgress();
 assert.deepEqual([...c.civicState.solved],['A']);assert.equal(c.civicState.score,1);
 assert.deepEqual([...c.guestProgress[0].payload.solved],['guest']);
 c.authState.user={id:'B'};await c.loadProgress();
 assert.deepEqual([...c.civicState.solved],['B']);await c.saveProgress('civics');
 assert.deepEqual(JSON.parse(calls.at(-1).body).payload.solved,['B']);
});
test('A failed cloud read cannot overwrite that account with local progress',async()=>{
 const {c,calls}=setup();c.apiFetch=async()=>{throw Error('offline');};
 await c.loadProgress();await c.saveProgress('civics');assert.equal(c.progressReady,false);assert.equal(calls.length,0);
});
