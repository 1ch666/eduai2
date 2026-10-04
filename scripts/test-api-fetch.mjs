import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('    async function apiFetch('), html.indexOf('    function renderAccount('));
function setup(user = null, reply = () => Response.json({})) {
  const calls = [];
  const context = vm.createContext({ TextDecoder, authState: { user, csrfToken: user ? 'test-csrf' : '' },
    AUTH_API_PATH: 'https://api.example/api/auth', PROGRESS_API_PATH: 'https://api.example/api/progress',
    fetch: async (url, options) => { calls.push({ url, options }); return reply(); } });
  vm.runInContext(source, context);
  return { calls, apiFetch: context.apiFetch };
}
test('Anonymous messages and AI omit credentials for legacy Worker CORS', async () => {
  const p = setup();
  for (const path of ['messages', 'ai/status', 'ai/ask']) {
    await p.apiFetch(`https://api.example/api/${path}`, { method: 'POST', body: '{}' });
    assert.equal(p.calls.at(-1).options.credentials, 'omit');
    assert.equal(p.calls.at(-1).options.headers['X-CSRF-Token'], undefined);
  }
});
test('Authentication and progress always include cookies', async () => {
  const p = setup();
  for (const path of ['auth/session', 'auth/login', 'progress']) {
    await p.apiFetch(`https://api.example/api/${path}`);
    assert.equal(p.calls.at(-1).options.credentials, 'include');
  }
});
test('Signed-in public writes retain cookies and CSRF', async () => {
  const p = setup({ id: 'test-user' });
  await p.apiFetch('https://api.example/api/messages', { method: 'POST', body: '{}' });
  assert.equal(p.calls[0].options.credentials, 'include');
  assert.equal(p.calls[0].options.headers['X-CSRF-Token'], 'test-csrf');
});

const ndjson=items=>new Response(items.map(x=>JSON.stringify(x)).join('\n'),{headers:{'Content-Type':'application/x-ndjson'}});
test('browser consumes real deltas but requires a complete terminal answer',async()=>{
  const deltas=[];
  const p=setup(null,()=>ndjson([{type:'meta'},{type:'delta',text:'成年'},{type:'done',answer:'成年。'}]));
  const result=await p.apiFetch('/api/ai/ask',{onText:text=>deltas.push(text)});
  assert.deepEqual(deltas,['成年']);assert.equal(result.payload.answer,'成年。');
});
test('browser rejects interrupted, error and post-terminal streams',async()=>{
  for(const items of [[{type:'delta',text:'部分'}],[{type:'error',code:'TIMEOUT',error:'未完成'}],
    [{type:'done',answer:'完成'},{type:'delta',text:'多餘'}],[{type:'done'}]]){
    await assert.rejects(setup(null,()=>ndjson(items)).apiFetch('/api/ai/ask'));
  }
});
