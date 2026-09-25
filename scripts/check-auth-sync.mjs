import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const code = await readFile(new URL('../auth-sync.js', import.meta.url), 'utf8');
function browser(hostname = 'example.test', pathname = '/practice/') {
  const listeners = {}, sent = [], stored = [], requests = [];
  let data = {user:null}, reloads = 0, redirect;
  const context = {
    location: {hostname, pathname, search:'?subject=law', hash:'#top',
      replace: url => {redirect=url;}, reload: () => {reloads++;}},
    document:{hidden:false,addEventListener:(name,fn)=>{listeners[name]=fn;}},
    addEventListener:(name,fn)=>{listeners[name]=fn;},
    BroadcastChannel: class {postMessage(value){sent.push(value);}},
    localStorage:{setItem:(...args)=>stored.push(args)},
    crypto:{randomUUID:()=> 'change-id'}, AbortSignal,
    fetch: async (url, options) => {requests.push({url,options});
      if(data instanceof Error)throw data;
      return {ok:true,json:async()=>data};}
  };
  context.window=context;
  vm.runInNewContext(code,context);
  return {context,listeners,sent,stored,requests,set:p=>{data=p;},
    get reloads(){return reloads;},get redirect(){return redirect;}};
}
test('session requests bypass cache, carry cookies and do not persist credentials',async()=>{
  const b=browser(); b.set({user:{id:'alice'},csrfToken:'private'});
  await b.context.EduAuth.session(); await b.context.EduAuth.check();
  assert.equal(b.reloads,0); assert.equal(b.requests[0].options.cache,'no-store');
  assert.equal(b.requests[0].options.credentials,'include'); assert.equal(b.stored.length,0);
});
test('login, logout, account switch and CSRF rotation refresh stale pages',async()=>{
  for(const [before,after] of [
    [{user:null},{user:{id:'a'},csrfToken:'a'}],
    [{user:{id:'a'},csrfToken:'a'},{user:null}],
    [{user:{id:'a'},csrfToken:'a'},{user:{id:'b'},csrfToken:'b'}],
    [{user:{id:'a'},csrfToken:'a'},{user:{id:'a'},csrfToken:'new'}]
  ]) {const b=browser();b.set(before);await b.context.EduAuth.session();b.set(after);
    await b.context.EduAuth.check();assert.equal(b.reloads,1);}
});
test('offline is not logout; recovery rechecks',async()=>{
  const b=browser();await b.context.EduAuth.session();b.set(Error('offline'));
  await b.context.EduAuth.check();assert.equal(b.reloads,0);
  b.set({user:{id:'a'}});await b.listeners.online();assert.equal(b.reloads,1);
});
test('local change broadcasts only a signal; does not reload its own form',async()=>{
  const b=browser();await b.context.EduAuth.session();
  const p={user:{id:'a'},csrfToken:'private'};b.set(p);b.context.EduAuth.changed(p);
  await b.context.EduAuth.check();assert.equal(b.reloads,0);
  assert.deepEqual(b.sent,['changed']);assert.equal(JSON.stringify(b.stored).includes('private'),false);
});
test('focus, back/forward restore and visibility recheck; hidden tabs defer',async()=>{
  for(const event of ['focus','pageshow','visibilitychange']) {
    const b=browser();await b.context.EduAuth.session();b.set({user:{id:'a'}});
    b.context.document.hidden=true;await b.listeners[event]();assert.equal(b.reloads,0);
    b.context.document.hidden=false;await b.listeners[event]();assert.equal(b.reloads,1);
  }
});
test('initial session load cannot race pageshow into a reload',async()=>{
  const b=browser();const pending=b.context.EduAuth.session();
  await b.listeners.pageshow();await pending;assert.equal(b.reloads,0);
});
test('Pages tools move to same-origin Worker with route/query/hash intact',()=>{
  for(const route of ['court','practice','planner','rankings','photo']) {
    const b=browser('1ch666.github.io',`/eduai2/${route}/`);
    assert.equal(b.redirect,`https://civic-law-lab-212.yichengc869.workers.dev/${route}/?subject=law#top`);
  }
  assert.equal(browser('example.test').redirect,undefined);
  assert.equal(browser('1ch666.github.io','/eduai2/').redirect,undefined);
});
