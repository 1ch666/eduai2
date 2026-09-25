import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const path=new URL('../Assets/WebGLTemplates/Court/index.html',import.meta.url);
const script=readFileSync(path,'utf8').match(/<script data-court-entry>([\s\S]*?)<\/script>/)[1];
function entry(hostname,search='',iframe=false){const calls=[],window={};window.parent=iframe?{}:window;vm.runInNewContext(script,{window,URLSearchParams,location:{hostname,search,replace:u=>calls.push(u)}});return calls;}
test('public standalone play routes to cloud game, never legacy tablet',()=>{for(const host of ['1ch666.github.io','civic-law-lab-212.yichengc869.workers.dev'])assert.deepEqual(entry(host),['https://civic-law-lab-212.yichengc869.workers.dev/court/?game=1']);});
test('hosted iframe, explicit local practice and Docker localhost stay playable',()=>{assert.deepEqual(entry('1ch666.github.io','?court=1',true),[]);assert.deepEqual(entry('1ch666.github.io','?local=1'),[]);assert.deepEqual(entry('127.0.0.1'),[]);});
