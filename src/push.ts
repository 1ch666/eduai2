// Web Push subscription management.
// VAPID keys are stored as Worker secrets (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).
// Actual push sending is triggered by planner slot start times (requires cron,
// which needs Cloudflare paid plan — mark as unavailable until confirmed free).
import { DurableObject } from 'cloudflare:workers';
import type { AppEnv } from './env';
import { readJsonObject, type Responder } from './http';
import { resolveSession, csrfTokenMatches } from './session';

type SubscriptionRow = { endpoint: string; user_id: string; p256dh: string; auth: string; created_at: string };

export class PushStore extends DurableObject<AppEnv> {
  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          endpoint TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS subs_user ON subscriptions(user_id);
      `);
    });
  }

  upsert(endpoint: string, userId: string, p256dh: string, auth: string): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO subscriptions VALUES(?,?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth`,
      endpoint, userId, p256dh, auth, new Date().toISOString());
    // Keep at most 10 subscriptions per user (old browsers drop off)
    const rows = this.ctx.storage.sql.exec<{ endpoint: string }>(
      'SELECT endpoint FROM subscriptions WHERE user_id=? ORDER BY created_at DESC', userId).toArray();
    if (rows.length > 10) {
      rows.slice(10).forEach(r =>
        this.ctx.storage.sql.exec('DELETE FROM subscriptions WHERE endpoint=?', r.endpoint));
    }
  }

  remove(endpoint: string, userId: string): void {
    this.ctx.storage.sql.exec('DELETE FROM subscriptions WHERE endpoint=? AND user_id=?', endpoint, userId);
  }

  forUser(userId: string): SubscriptionRow[] {
    return this.ctx.storage.sql.exec<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE user_id=?', userId).toArray();
  }
}

// ── HTTP handler ─────────────────────────────────────────────────────────────

export async function handlePush(
  request: Request, env: AppEnv, respond: Responder, trustedOrigin?: string
): Promise<Response> {
  const { pathname } = new URL(request.url);

  // Public: return VAPID public key so client can subscribe
  if (pathname === '/api/push/vapid-key' && request.method === 'GET') {
    const publicKey = env.VAPID_PUBLIC_KEY;
    if (!publicKey) return respond({ publicKey: null, note: 'VAPID 尚未設定；請設定 VAPID_PUBLIC_KEY secret 後才能啟用通知。' });
    return respond({ publicKey });
  }

  const session = await resolveSession(request, env);
  if (!session) return respond({ error: '請先登入' }, 401);
  if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新整理頁面後再試' }, 403);

  const store = env.PUSH_STORE;
  const pushStore = store.getByName('global');

  if (pathname === '/api/push/subscribe' && request.method === 'POST') {
    const body = await readJsonObject(request, 2048, respond, '訂閱資料過長');
    if (body.error) return body.error;
    const { endpoint, keys } = body.value;
    const k = keys as Record<string, unknown> | null | undefined;
    if (typeof endpoint !== 'string' || typeof k?.p256dh !== 'string' || typeof k?.auth !== 'string') {
      return respond({ error: '訂閱格式錯誤' }, 400);
    }
    await pushStore.upsert(endpoint, session.user.id, k.p256dh, k.auth);
    return respond({ subscribed: true });
  }

  if (pathname === '/api/push/unsubscribe' && request.method === 'POST') {
    const body = await readJsonObject(request, 1024, respond, '資料過長');
    if (body.error) return body.error;
    if (typeof body.value.endpoint !== 'string') return respond({ error: 'endpoint 格式錯誤' }, 400);
    await pushStore.remove(body.value.endpoint, session.user.id);
    return respond({ unsubscribed: true });
  }

  return respond({ error: '找不到端點' }, 404);
}
