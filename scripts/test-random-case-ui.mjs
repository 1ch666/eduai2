import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installRandomCase,RANDOM_CASE_BUSY,generationMessage} from '../court/random-case.js';
const html=await readFile(new URL('../court/index.html',import.meta.url),'utf8');
const shell=await readFile(new URL('../court/court.js',import.meta.url),'utf8');

function harness({api,ready=()=>true}={}){
 const listeners=[],statuses=[],opened=[],calls=[],errors=[];let n=0;
 const button={disabled:false,addEventListener(type,fn){assert.equal(type,'click');listeners.push(fn);}};
 // Mirrors court.js run(): errors become a status line, never an unhandled rejection.
 const pending=[];const run=fn=>{const p=(async()=>{try{await fn();}catch(e){errors.push(e);statuses.push(e.message);}})();pending.push(p);return p;};
 installRandomCase({button,status:s=>statuses.push(s),open:v=>opened.push(v),run,ready,randomUUID:()=>`00000000-0000-4000-8000-00000000000${n++}`,
  api:async(path,body)=>{calls.push({path,body,disabled:button.disabled});return api(path,body);}});
 const click=()=>{listeners.forEach(fn=>fn());return Promise.all(pending);};
 return {button,click,statuses,opened,calls,errors};
}
const view={id:'11111111-1111-4111-8111-111111111111',title:'[AI虛構] 測試'};
test('fallback reasons are distinct and unknown content is never rendered',()=>{
 for(const [reason,expected] of [['OUTPUT_TRUNCATED','長度上限'],['COOLDOWN','冷卻'],['BUDGET','次數'],['QUOTA','供應商'],['INVALID_DRAFT','安全檢查']]){
  assert.ok(generationMessage({mode:'library',reason}).includes(expected));
 }
 for(const reason of ['<script>secret</script>','__proto__','constructor']){
  assert.equal(generationMessage({mode:'library',reason}),'AI 暫不可用，已改用題庫隨機案件並保存場次。');
 }
});

test('setup page offers both entries and keeps the manual form',async()=>{
 assert.match(html,/<button id="random-case" type="button">完全隨機 AI 案件<\/button>/);
 // The random entry sits outside the form: it cannot submit or read form fields.
 assert.ok(html.indexOf('id="random-case"')<html.indexOf('<form id="setup-form">'));
 for(const id of ['setup-form','case','role','create','sessions','new-session','show-scene'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/name="variation"/);
 assert.match(shell,/import \{ installRandomCase \} from '\.\/random-case\.js';/);
 assert.match(shell,/installRandomCase\(\{button:\$\('random-case'\),api,open,status,run,/);
 for(const path of ['/api/court/cases/generate','/api/court/sessions'])assert.ok(shell.includes(`'${path}'`),path);
 assert.doesNotMatch(await readFile(new URL('../court/random-case.js',import.meta.url),'utf8'),/FormData|caseId|setup-form/);
});
test('click posts only a requestId, disables the button, then opens the view',async()=>{
 const h=harness({api:async()=>({view,generation:{mode:'ai'}})});
 await h.click();
 assert.deepEqual(h.calls,[{path:'/api/court/cases/random',body:{requestId:'00000000-0000-4000-8000-000000000000'},disabled:true}]);
 assert.deepEqual(h.opened,[view]);assert.equal(h.button.disabled,false);
 assert.equal(h.statuses[0],RANDOM_CASE_BUSY);assert.match(h.statuses.at(-1),/AI 虛構/);
});
test('library fallback still enters the session and says so',async()=>{
 const h=harness({api:async()=>({view:{...view,title:'[題庫] 測試'},generation:{mode:'library'}})});
 await h.click();assert.equal(h.opened.length,1);assert.match(h.statuses.at(-1),/題庫/);
});
test('repeat clicks while generating never send a second request',async()=>{
 let release;const h=harness({api:()=>new Promise(r=>release=r)});
 const first=h.click();assert.equal(h.button.disabled,true);
 await Promise.resolve();h.click();h.click();
 release({view,generation:{mode:'ai'}});await first;
 assert.equal(h.calls.length,1);assert.equal(h.opened.length,1);assert.equal(h.button.disabled,false);
});
test('failure restores the button; transport errors retry with the same requestId',async()=>{
 let mode='network';
 const h=harness({api:async()=>{if(mode==='network')throw new TypeError('Failed to fetch');if(mode==='server')throw Error('生成太頻繁');return {view,generation:{mode:'ai'}};}});
 await h.click();assert.equal(h.button.disabled,false);assert.equal(h.opened.length,0);assert.equal(h.statuses.at(-1),'Failed to fetch');
 mode='server';await h.click();assert.equal(h.button.disabled,false);assert.equal(h.statuses.at(-1),'生成太頻繁');
 mode='ok';await h.click();
 const ids=h.calls.map(c=>c.body.requestId);
 // Same key after a lost response (server replays its receipt); fresh key after a server answer.
 assert.equal(ids[0],ids[1]);assert.notEqual(ids[2],ids[1]);assert.equal(h.opened.length,1);
});
test('signed-out users are sent to login without calling the API',async()=>{
 const h=harness({api:async()=>assert.fail('no request'),ready:()=>false});
 await h.click();assert.equal(h.calls.length,0);assert.equal(h.button.disabled,false);
});
