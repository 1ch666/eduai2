// Shared browser session lifecycle. The server's HttpOnly cookie is authoritative.
// Never persist/broadcast a user, password, session cookie or CSRF token.
(() => {
  const worker = 'https://civic-law-lab-212.yichengc869.workers.dev';
  const onPages = location.hostname.endsWith('github.io');
  const route = location.pathname.replace(/^\/eduai2(?=\/|$)/, '');
  if (onPages && /^\/(court|practice|planner|rankings|photo)(\/|$)/.test(route)) {
    location.replace(worker + route + location.search + location.hash);
  }
  let snapshot, revision = 0, checking = false, attempted = false, loading = 0;
  let channel;
  try { channel = new BroadcastChannel('eduai-auth'); } catch { /* focus fallback */ }
  const fingerprint = p => JSON.stringify([p.user?.id || null, p.csrfToken || '']);
  function accept(p) { snapshot = fingerprint(p); revision++; }
  async function request() {
    const response = await fetch('/api/auth/session', {
      credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw Error('無法確認登入狀態，請恢復連線後再試。');
    const p = await response.json();
    if (!Object.prototype.hasOwnProperty.call(p, 'user')) throw Error('登入服務尚未設定。');
    return p;
  }
  async function session() {
    attempted = true;
    if (onPages) { const p = { user: null }; accept(p); return p; }
    loading++;
    try {
      const p = await request();
      accept(p);
      return p;
    } finally { loading--; }
  }
  function changed(p) {
    accept(p);
    channel?.postMessage('changed');
    try { localStorage.setItem('eduai-auth-change', crypto.randomUUID()); } catch { /* optional */ }
  }
  async function check() {
    if (onPages || !attempted || loading || checking || document.hidden) return;
    checking = true;
    const started = revision;
    try {
      const p = await request();
      // A local login/logout that completed during this request wins.
      // Reload only on session change: clears the old user's private UI and tokens.
      if (started === revision && snapshot !== fingerprint(p)) location.reload();
    } catch { /* Offline is not logout. Retry on focus/online; do not erase work. */ }
    finally { checking = false; }
  }
  window.EduAuth = { session, changed, check, onPages, worker };
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('storage', e => { if (e.key === 'eduai-auth-change') void check(); });
  if (channel) channel.onmessage = () => { void check(); };
})();
