// Phase 2 weekly planner: schedule slots, focus timer heartbeat, conflict detection.
// The AI can only produce a draft; the user must confirm before anything is saved.
// All times are stored in UTC; the client sends tz for display only.
import { DurableObject } from 'cloudflare:workers';
import type { AppEnv } from './env';
import { readJsonObject, type Responder } from './http';
import { resolveSession, csrfTokenMatches } from './session';

// ── Types ────────────────────────────────────────────────────────────────────

export type Recurrence = 'none' | 'weekly';
export type SlotInput = {
  title: string;         // e.g. "複習民法"
  subject: string;       // e.g. "law"
  startIso: string;      // ISO-8601 UTC datetime
  endIso: string;
  recurrence: Recurrence;
  examDate?: string;     // ISO-8601 UTC date — sets a deadline marker
  note?: string;
};
type SlotRow = { id: string; user_id: string; title: string; subject: string;
  start_iso: string; end_iso: string; recurrence: string;
  exam_date: string | null; note: string | null; created_at: string };

const MAX_SLOTS = 200;
const MAX_TITLE = 80;
const MAX_NOTE  = 200;

// ── Durable Object ───────────────────────────────────────────────────────────

export class Planner extends DurableObject<AppEnv> {
  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS slots (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          subject TEXT NOT NULL,
          start_iso TEXT NOT NULL,
          end_iso TEXT NOT NULL,
          recurrence TEXT NOT NULL DEFAULT 'none',
          exam_date TEXT,
          note TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS slots_user_start ON slots(user_id, start_iso);
        CREATE TABLE IF NOT EXISTS focus_sessions (
          id TEXT PRIMARY KEY,
          slot_id TEXT,
          started_at INTEGER NOT NULL,
          last_beat INTEGER NOT NULL,
          ended_at INTEGER,
          paused_seconds INTEGER NOT NULL DEFAULT 0,
          tz TEXT NOT NULL DEFAULT 'Asia/Taipei'
        );
        CREATE TABLE IF NOT EXISTS limits (
          key TEXT PRIMARY KEY,
          window INTEGER NOT NULL,
          count INTEGER NOT NULL
        );
      `);
    });
  }

  allow(key: string, limit: number, windowMs = 60_000): boolean {
    const window = Math.floor(Date.now() / windowMs);
    this.ctx.storage.sql.exec('DELETE FROM limits WHERE window < ?', window - 1);
    const r = this.ctx.storage.sql.exec<{ window: number; count: number }>(
      'SELECT window, count FROM limits WHERE key = ?', key).toArray()[0];
    if (r?.window === window && r.count >= limit) return false;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO limits VALUES(?,?,?)',
      key, window, r?.window === window ? r.count + 1 : 1);
    return true;
  }

  listSlots(userId: string, from?: string, to?: string): SlotRow[] {
    if (from && to) {
      return this.ctx.storage.sql.exec<SlotRow>(
        'SELECT * FROM slots WHERE user_id=? AND start_iso>=? AND start_iso<=? ORDER BY start_iso',
        userId, from, to).toArray();
    }
    return this.ctx.storage.sql.exec<SlotRow>(
      'SELECT * FROM slots WHERE user_id=? ORDER BY start_iso LIMIT 100', userId).toArray();
  }

  getSlot(id: string, userId: string): SlotRow | undefined {
    return this.ctx.storage.sql.exec<SlotRow>(
      'SELECT * FROM slots WHERE id=? AND user_id=?', id, userId).toArray()[0];
  }

  /** Check if a new slot overlaps any existing slots for the user. */
  conflicts(userId: string, startIso: string, endIso: string, excludeId?: string): SlotRow[] {
    const rows = this.ctx.storage.sql.exec<SlotRow>(
      `SELECT * FROM slots WHERE user_id=? AND start_iso < ? AND end_iso > ?
       ${excludeId ? 'AND id != ?' : ''}`,
      ...(excludeId ? [userId, endIso, startIso, excludeId] : [userId, endIso, startIso])
    ).toArray();
    return rows;
  }

  createSlot(id: string, userId: string, input: SlotInput): { ok: true; slot: SlotRow } | { ok: false; error: string } {
    const count = this.ctx.storage.sql.exec<{ n: number }>(
      'SELECT count(*) AS n FROM slots WHERE user_id=?', userId).one().n;
    if (count >= MAX_SLOTS) return { ok: false, error: `排程上限 ${MAX_SLOTS} 筆，請刪除舊紀錄後再新增` };
    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      'INSERT INTO slots VALUES(?,?,?,?,?,?,?,?,?,?)',
      id, userId, input.title, input.subject, input.startIso, input.endIso,
      input.recurrence, input.examDate ?? null, input.note ?? null, now);
    return { ok: true, slot: this.getSlot(id, userId)! };
  }

  updateSlot(id: string, userId: string, input: Partial<SlotInput>): { ok: true; slot: SlotRow } | { ok: false; error: string } {
    const existing = this.getSlot(id, userId);
    if (!existing) return { ok: false, error: '排程不存在' };
    // Map camelCase input fields to the snake_case column names used by the DB.
    const title      = input.title      ?? existing.title;
    const subject    = input.subject    ?? existing.subject;
    const start_iso  = input.startIso   ?? existing.start_iso;
    const end_iso    = input.endIso     ?? existing.end_iso;
    const recurrence = input.recurrence ?? existing.recurrence;
    this.ctx.storage.sql.exec(
      'UPDATE slots SET title=?,subject=?,start_iso=?,end_iso=?,recurrence=?,exam_date=?,note=? WHERE id=? AND user_id=?',
      title, subject, start_iso, end_iso, recurrence,
      'examDate' in input ? (input.examDate ?? null) : existing.exam_date,
      'note' in input ? (input.note ?? null) : existing.note, id, userId);
    return { ok: true, slot: this.getSlot(id, userId)! };
  }

  deleteSlot(id: string, userId: string): boolean {
    const n = this.ctx.storage.sql.exec<{ n: number }>(
      'SELECT changes() AS n').one;
    this.ctx.storage.sql.exec('DELETE FROM slots WHERE id=? AND user_id=?', id, userId);
    return this.ctx.storage.sql.exec<{ n: number }>('SELECT changes() AS n').one().n > 0;
  }

  // ── Focus timer ────────────────────────────────────────────────────────────

  startFocus(id: string, slotId: string | null, tz: string): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO focus_sessions VALUES(?,?,?,?,NULL,0,?)',
      id, slotId, now, now, tz);
  }

  heartbeat(id: string): { ok: boolean; elapsed: number } {
    const row = this.ctx.storage.sql.exec<{ started_at: number; last_beat: number; ended_at: number | null }>(
      'SELECT started_at, last_beat, ended_at FROM focus_sessions WHERE id=?', id).toArray()[0];
    if (!row || row.ended_at !== null) return { ok: false, elapsed: 0 };
    const now = Date.now();
    // Gap > 5 min means offline; don't count that gap
    const gap = now - row.last_beat;
    const paused = gap > 300_000 ? gap : 0;
    this.ctx.storage.sql.exec(
      'UPDATE focus_sessions SET last_beat=?, paused_seconds=paused_seconds+? WHERE id=?',
      now, Math.floor(paused / 1000), id);
    const elapsed = Math.floor((now - row.started_at) / 1000) -
      this.ctx.storage.sql.exec<{ p: number }>('SELECT paused_seconds AS p FROM focus_sessions WHERE id=?', id).one().p;
    return { ok: true, elapsed: Math.max(0, elapsed) };
  }

  endFocus(id: string): { elapsed: number } {
    const row = this.ctx.storage.sql.exec<{ started_at: number; paused_seconds: number }>(
      'SELECT started_at, paused_seconds FROM focus_sessions WHERE id=?', id).toArray()[0];
    if (!row) return { elapsed: 0 };
    this.ctx.storage.sql.exec('UPDATE focus_sessions SET ended_at=? WHERE id=?', Date.now(), id);
    const elapsed = Math.max(0, Math.floor((Date.now() - row.started_at) / 1000) - row.paused_seconds);
    return { elapsed };
  }
}

// ── Validation helpers ───────────────────────────────────────────────────────

function validIso(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}
function parseSlotInput(b: Record<string, unknown>): SlotInput | string {
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > MAX_TITLE)
    return `標題需為 1–${MAX_TITLE} 個字`;
  if (!validIso(b.startIso)) return '開始時間格式錯誤（需 ISO-8601 UTC）';
  if (!validIso(b.endIso))   return '結束時間格式錯誤';
  if (new Date(b.endIso as string) <= new Date(b.startIso as string)) return '結束時間須晚於開始時間';
  const dur = (new Date(b.endIso as string).getTime() - new Date(b.startIso as string).getTime()) / 60000;
  if (dur > 60 * 24) return '單一排程不能超過 24 小時';
  if (!['none','weekly'].includes(b.recurrence as string)) return '重複規則需為 none 或 weekly';
  if (b.examDate !== undefined && b.examDate !== null && !validIso(b.examDate)) return '考試日期格式錯誤';
  if (b.note !== undefined && typeof b.note === 'string' && b.note.length > MAX_NOTE) return `備註不超過 ${MAX_NOTE} 字`;
  return {
    title: (b.title as string).trim(),
    subject: typeof b.subject === 'string' ? b.subject.slice(0,40) : '',
    startIso: b.startIso as string,
    endIso: b.endIso as string,
    recurrence: b.recurrence as Recurrence,
    examDate: typeof b.examDate === 'string' ? b.examDate : undefined,
    note: typeof b.note === 'string' ? b.note.trim() || undefined : undefined
  };
}

// ── HTTP handler ─────────────────────────────────────────────────────────────

export async function handlePlanner(
  request: Request, env: AppEnv, respond: Responder, trustedOrigin?: string
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const session = await resolveSession(request, env);
  if (!session) return respond({ error: '請登入才能使用排程功能' }, 401);

  const planner = env.PLANNER.getByName(session.user.id);

  // ── GET /api/planner/slots ────────────────────────────────────────────────
  if (pathname === '/api/planner/slots' && request.method === 'GET') {
    const sp = new URL(request.url).searchParams;
    const slots = await planner.listSlots(session.user.id, sp.get('from') ?? undefined, sp.get('to') ?? undefined);
    return respond({ slots });
  }

  // ── POST /api/planner/slots — create (user-confirmed) ────────────────────
  if (pathname === '/api/planner/slots' && request.method === 'POST') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新整理頁面後再試' }, 403);
    if (!await planner.allow('create', 60)) return respond({ error: '新增太頻繁，請稍候' }, 429);
    const body = await readJsonObject(request, 2048, respond, '排程資料過長');
    if (body.error) return body.error;
    const input = parseSlotInput(body.value);
    if (typeof input === 'string') return respond({ error: input }, 400);
    const conflicts = await planner.conflicts(session.user.id, input.startIso, input.endIso);
    if (conflicts.length) return respond({ error: '與現有排程時段衝突', conflicts }, 409);
    const id = crypto.randomUUID();
    const result = await planner.createSlot(id, session.user.id, input);
    return result.ok ? respond({ slot: result.slot }, 201) : respond({ error: result.error }, 409);
  }

  // ── GET /api/planner/slots/:id ───────────────────────────────────────────
  const slotMatch = pathname.match(/^\/api\/planner\/slots\/([0-9a-f-]{36})$/);
  if (slotMatch) {
    const id = slotMatch[1];
    if (request.method === 'GET') {
      const slot = await planner.getSlot(id, session.user.id);
      return slot ? respond({ slot }) : respond({ error: '排程不存在' }, 404);
    }
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新整理頁面後再試' }, 403);
    if (request.method === 'PUT') {
      if (!await planner.allow('update', 120)) return respond({ error: '更新太頻繁，請稍候' }, 429);
      const body = await readJsonObject(request, 2048, respond, '排程資料過長');
      if (body.error) return body.error;
      const input = parseSlotInput(body.value);
      if (typeof input === 'string') return respond({ error: input }, 400);
      const conflicts = await planner.conflicts(session.user.id, input.startIso, input.endIso, id);
      if (conflicts.length) return respond({ error: '與現有排程時段衝突', conflicts }, 409);
      const result = await planner.updateSlot(id, session.user.id, input);
      return result.ok ? respond({ slot: result.slot }) : respond({ error: result.error }, 404);
    }
    if (request.method === 'DELETE') {
      const deleted = await planner.deleteSlot(id, session.user.id);
      return deleted ? respond({ deleted: true }) : respond({ error: '排程不存在' }, 404);
    }
    return respond({ error: '方法不支援' }, 405);
  }

  // ── Focus timer endpoints ─────────────────────────────────────────────────
  if (pathname === '/api/planner/focus/start' && request.method === 'POST') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新整理頁面後再試' }, 403);
    if (!await planner.allow('focus', 20)) return respond({ error: '操作太頻繁' }, 429);
    const body = await readJsonObject(request, 256, respond, '資料過長');
    if (body.error) return body.error;
    const id = crypto.randomUUID();
    const slotId = typeof body.value.slotId === 'string' ? body.value.slotId : null;
    const tz = typeof body.value.tz === 'string' ? body.value.tz.slice(0,50) : 'Asia/Taipei';
    await planner.startFocus(id, slotId, tz);
    return respond({ focusId: id });
  }
  if (pathname === '/api/planner/focus/beat' && request.method === 'POST') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新整理頁面後再試' }, 403);
    const body = await readJsonObject(request, 128, respond, '資料過長');
    if (body.error) return body.error;
    if (typeof body.value.focusId !== 'string') return respond({ error: 'focusId 格式錯誤' }, 400);
    const result = await planner.heartbeat(body.value.focusId);
    return result.ok ? respond(result) : respond({ error: '計時不存在或已結束' }, 404);
  }
  if (pathname === '/api/planner/focus/end' && request.method === 'POST') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新整理頁面後再試' }, 403);
    const body = await readJsonObject(request, 128, respond, '資料過長');
    if (body.error) return body.error;
    if (typeof body.value.focusId !== 'string') return respond({ error: 'focusId 格式錯誤' }, 400);
    const result = await planner.endFocus(body.value.focusId);
    return respond(result);
  }

  return respond({ error: '找不到端點' }, 404);
}
