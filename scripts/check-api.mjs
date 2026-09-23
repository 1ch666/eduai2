// End-to-end check against a running Worker (default: `npm run dev` on 8787).
// Exercises register, session, CSRF, progress, notes and the API guards.
// Usage: node scripts/check-api.mjs [baseUrl]
import assert from 'node:assert/strict';

const base = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const origin = base;
const username = `check_${Math.random().toString(36).slice(2, 10)}`;
const password = 'study-civics-2026';
const clientId = crypto.randomUUID();

function sessionCookie(response) {
  const header = response.headers.getSetCookie?.() ?? [];
  const cookie = header.find(value => value.startsWith('civic_session=') || value.startsWith('__Host-civic_session='));
  assert.ok(cookie, 'expected a session cookie');
  assert.ok(/HttpOnly/i.test(cookie), 'session cookie must be HttpOnly');
  return cookie.split(';')[0];
}

async function call(path, { method = 'GET', body, cookie, csrf, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(15000),
    method,
    headers: {
      Accept: 'application/json',
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

// 1. Anonymous session lookup.
{
  const { response, payload } = await call('/api/auth/session');
  assert.equal(response.status, 200);
  assert.equal(payload.user, null);
}

// 2. Weak or malformed registrations are refused.
for (const [body, status] of [
  [{ username: 'AB', password }, 400],
  [{ username, password: 'short' }, 400]
]) {
  const { response } = await call('/api/auth/register', { method: 'POST', body });
  assert.equal(response.status, status, `expected ${status} for ${JSON.stringify(body)}`);
}

// 3. Register, then reuse the cookie.
const registered = await call('/api/auth/register', {
  method: 'POST',
  body: { username, password, displayName: '測試同學' }
});
assert.equal(registered.response.status, 201, JSON.stringify(registered.payload));
assert.equal(registered.payload.user.username, username);
assert.equal(registered.payload.user.displayName, '測試同學');
assert.ok(registered.payload.csrfToken, 'register must hand out a CSRF token');
let cookie = sessionCookie(registered.response);
let csrf = registered.payload.csrfToken;

// 4. The same handle cannot be taken twice.
{
  const { response } = await call('/api/auth/register', { method: 'POST', body: { username, password } });
  assert.equal(response.status, 409);
}

// 5. The cookie resolves to the account.
{
  const { payload } = await call('/api/auth/session', { cookie });
  assert.equal(payload.user.username, username);
  assert.equal(payload.csrfToken, csrf);
}

// 6. Progress needs the CSRF header, then round-trips.
{
  const without = await call('/api/progress', { method: 'PUT', cookie, body: { scope: 'civics', payload: { solved: ['a'] } } });
  assert.equal(without.response.status, 403, 'missing CSRF token must be refused');

  const saved = await call('/api/progress', {
    method: 'PUT',
    cookie,
    csrf,
    body: { scope: 'civics', payload: { solved: ['q-1', 'q-2'], score: 2 } }
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.payload));
  assert.equal(saved.payload.record.selfReported, true);

  const badScope = await call('/api/progress', { method: 'PUT', cookie, csrf, body: { scope: 'grades', payload: {} } });
  assert.equal(badScope.response.status, 400);

  const read = await call('/api/progress', { cookie });
  const civics = read.payload.records.find(record => record.scope === 'civics');
  assert.deepEqual(civics.payload.solved, ['q-1', 'q-2']);
  assert.equal(civics.selfReported, true);
}

// 7. Progress is private: no cookie, no data.
{
  const { response } = await call('/api/progress');
  assert.equal(response.status, 401);
}

// 8. A signed-in note carries the display name.
{
  const messageId = crypto.randomUUID();
  const { response, payload } = await call('/api/messages', {
    method: 'POST',
    cookie,
    csrf,
    body: { text: '測試留言：登入後應顯示名稱', clientId, messageId }
  });
  assert.equal(response.status, 201, JSON.stringify(payload));
  assert.equal(payload.message.author.displayName, '測試同學');

  const listed = await call('/api/messages');
  assert.ok(listed.payload.messages.some(message => message.id === messageId));
}

// 9. Untrusted origins cannot write.
{
  const response = await fetch(`${base}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
    body: JSON.stringify({ text: 'nope', clientId, messageId: crypto.randomUUID() })
  });
  assert.equal(response.status, 403);
}

// 10. Logout clears the cookie and invalidates the session.
{
  const { response } = await call('/api/auth/logout', { method: 'POST', cookie, csrf, body: {} });
  assert.equal(response.status, 200);
  const cleared = response.headers.getSetCookie?.() ?? [];
  assert.ok(cleared.some(value => /Max-Age=0/.test(value)), 'logout must clear the cookie');
  const after = await call('/api/auth/session', { cookie });
  assert.equal(after.payload.user, null, 'the old cookie must stop working');
}

// 11. Log back in with the same password.
{
  const { response, payload } = await call('/api/auth/login', { method: 'POST', body: { username, password } });
  assert.equal(response.status, 200, JSON.stringify(payload));
  cookie = sessionCookie(response);
  csrf = payload.csrfToken;
  const read = await call('/api/progress', { cookie });
  const civics = read.payload.records.find(record => record.scope === 'civics');
  assert.equal(civics.payload.score, 2, 'progress must survive a new login');
}

// 12. A wrong password is rejected.
{
  const { response } = await call('/api/auth/login', { method: 'POST', body: { username, password: `${password}x` } });
  assert.equal(response.status, 401);
}

// 13. The AI endpoints stay reachable and unknown routes 404.
{
  const status = await call('/api/ai/status');
  assert.equal(status.response.status, 200);
  assert.equal(status.payload.provider, 'Ollama');
  const missing = await call('/api/nope');
  assert.equal(missing.response.status, 404);
}

console.log(`API checks passed against ${base}: accounts, sessions, CSRF, progress, notes and guards.`);
