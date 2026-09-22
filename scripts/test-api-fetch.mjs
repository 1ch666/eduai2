import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('    async function apiFetch('), html.indexOf('    function renderAccount('));
function setup(user = null) {
  const calls = [];
  const context = vm.createContext({ authState: { user, csrfToken: user ? 'test-csrf' : '' },
    AUTH_API_PATH: 'https://api.example/api/auth', PROGRESS_API_PATH: 'https://api.example/api/progress',
    fetch: async (url, options) => { calls.push({ url, options }); return { json: async () => ({}) }; } });
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
