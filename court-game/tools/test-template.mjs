import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const html = await readFile(new URL('../Assets/WebGLTemplates/Court/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const tick = () => new Promise(resolve => setImmediate(resolve));

function createPage(pointerLock, rejectLoad = false, hosted = false) {
  const sent = [];
  let calls = 0;
  let resolveLoad, reject;
  let reportProgress;
  const loading = new Promise((resolve, fail) => { resolveLoad = resolve; reject = fail; });
  const nodes = Object.fromEntries(['game', 'start', 'status', 'progress', 'error', 'cover', 'input-mode', 'touch-ui'].map(id =>
    [id, { value: 0, hidden: false, listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; }, focus() {} }]));
  nodes.game.requestPointerLock = pointerLock;
  const documentEvents = {};
  const windowEvents = {}, posts = [];
  const parent = {postMessage:(...args)=>posts.push(args)};
  runInNewContext(script, {
    URLSearchParams, location: {search:hosted?'?court=1':'',origin:'http://localhost'},
    document: { getElementById: id => nodes[id], createElement: () => ({}), querySelector:()=>({}),
      addEventListener: (type, callback) => { documentEvents[type] = callback; },
      body: { appendChild: element => element.onload() } },
    window: { parent, addEventListener:(type,fn)=>windowEvents[type]=fn, devicePixelRatio: 2, CourtTouch: () => ({ enabled: false }) },
    createUnityInstance: (_canvas, _config, onProgress) => {
      calls++; reportProgress = onProgress; return loading;
    }
  });
  return { nodes, sent, documentEvents, windowEvents, parent, posts, calls: () => calls, report: v => reportProgress(v),
    finish: () => resolveLoad({ SendMessage: (...args) => sent.push(args) }), fail: () => reject(new Error('load failed')) };
}

test('Immediately initializes exactly once; cover only opens after ready', async () => {
  const page = createPage(() => Promise.resolve());
  const { nodes, sent } = page;
  assert.equal(page.calls(), 1);
  assert.equal(nodes.start.disabled, true);
  nodes.start.listeners.click();
  assert.equal(nodes.cover.hidden, false);
  page.report(0.42);
  assert.equal(nodes.progress.value, 42);
  page.report(0.2);
  assert.equal(nodes.progress.value, 42);
  page.report(1);
  assert.equal(nodes.progress.value, 99);
  page.finish(); await tick();
  assert.equal(nodes.progress.value, 100);
  assert.equal(nodes.start.textContent, '開始遊戲');
  assert.equal(nodes.cover.hidden, false);
  nodes.start.listeners.click(); nodes.start.listeners.click(); await tick();
  assert.equal(nodes.cover.hidden, true);
  assert.equal(page.calls(), 1);
  assert.deepEqual(sent, [['Player', 'BeginGame']]);
});
test('Hosted bridge accepts only trusted parent and whitelisted presentation messages', async () => {
  const p=createPage(()=>{throw Error('Hosted seat must not lock pointer');},false,true);
  const data={type:'court-view',mode:'seat',role:'judge',procedure:'civil'};
  const send=(override={})=>p.windowEvents.message({origin:'http://localhost',source:p.parent,data,...override});
  send(); assert.equal(p.sent.length,0);
  p.finish(); await tick(); p.nodes.start.listeners.click();
  assert.equal(p.posts.length,1);
  send({origin:'https://untrusted.example'}); send({source:{}});
  send({data:{...data,mode:'execute'}}); send({data:{...data,role:'admin'}});
  assert.equal(p.sent.length,1);
  send(); assert.equal(p.sent[1][0],'CourtPresentation'); assert.equal(p.sent[1][1],'SetView');
  assert.deepEqual(JSON.parse(p.sent[1][2]),{mode:'seat',role:'judge',procedure:'civil'});
});
test('Load failure never enables the start button', async () => {
  const page = createPage(undefined);
  page.fail(); await tick();
  assert.equal(page.nodes.error.hidden, false);
  assert.equal(page.nodes.start.disabled, true);
  page.nodes.start.listeners.click();
  assert.equal(page.nodes.cover.hidden, false);
});

test('Successful pointer lock does not enable fallback', async () => {
  const { nodes, sent, finish } = createPage(() => Promise.resolve());
  finish(); await tick();
  await nodes.game.requestPointerLock();
  assert.equal(sent.length, 0);
  assert.equal(nodes.start.textContent, '開始遊戲');
});
test('Rejected pointer lock uses drag look once without unhandled rejection', async () => {
  const { nodes, sent, documentEvents, finish } = createPage(() => Promise.reject(new Error('not supported')));
  finish(); await tick();
  await nodes.game.requestPointerLock();
  documentEvents.pointerlockerror();
  assert.deepEqual(sent, [['Player', 'EnableDragLook']]);
  assert.match(nodes['input-mode'].textContent, /拖曳/);
});
test('Missing pointer lock API queues fallback until Unity is ready', async () => {
  const { nodes, sent, finish } = createPage(undefined);
  nodes.game.requestPointerLock(); await tick();
  assert.equal(sent.length, 0);
  finish(); await tick();
  assert.deepEqual(sent, [['Player', 'EnableDragLook']]);
});
