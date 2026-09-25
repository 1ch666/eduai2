// Phase 3: global leaderboard and tier (段位) system.
// Leaderboard is opt-in only; users must explicitly join and may leave at any time.
// Score = sum of difficulty-weighted correct first-attempt answers.
// Weekly stats reset every Monday 00:00 Asia/Taipei via Cron trigger.
// Tiers are only shown when at least 20 participants are opted in.
import { DurableObject } from 'cloudflare:workers';
import type { AppEnv } from './env';
import type { Responder } from './http';
import { resolveSession, csrfTokenMatches } from './session';

export const TIERS = [
  { name: '見習生', minScore: 0 },
  { name: '初學者', minScore: 50 },
  { name: '進階者', minScore: 150 },
  { name: '熟練者', minScore: 300 },
  { name: '專家',   minScore: 500 },
] as const;

export function tierForScore(score: number): string {
  let tier: string = TIERS[0].name;
  for (const t of TIERS) { if (score >= t.minScore) tier = t.name; }
  return tier;
}

const MIN_TIER_PARTICIPANTS = 20;

/** Returns the Monday date string (YYYY-MM-DD) of the current week in Asia/Taipei (UTC+8). */
function weekStartTaipei(): string {
  const taipeiMs = Date.now() + 8 * 3_600_000;
  const d = new Date(taipeiMs);
  const dow = d.getUTCDay(); // 0=Sun
  const toMon = dow === 0 ? 6 : dow - 1;
  return new Date(taipeiMs - toMon * 86_400_000).toISOString().slice(0, 10);
}

type Row = {
  user_id: string; display_name: string; opted_in: number;
  score: number; correct: number; attempts: number;
  week_score: number; week_correct: number; week_attempts: number;
  week_start: string; updated_at: string;
};

export class Rankings extends DurableObject<AppEnv> {
  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          user_id       TEXT PRIMARY KEY,
          display_name  TEXT NOT NULL,
          opted_in      INTEGER NOT NULL DEFAULT 0,
          score         INTEGER NOT NULL DEFAULT 0,
          correct       INTEGER NOT NULL DEFAULT 0,
          attempts      INTEGER NOT NULL DEFAULT 0,
          week_score    INTEGER NOT NULL DEFAULT 0,
          week_correct  INTEGER NOT NULL DEFAULT 0,
          week_attempts INTEGER NOT NULL DEFAULT 0,
          week_start    TEXT NOT NULL DEFAULT '',
          updated_at    TEXT NOT NULL
        );
      `);
      // Incremental migration: add columns that didn't exist in earlier versions.
      for (const col of [
        'opted_in INTEGER NOT NULL DEFAULT 0',
        'week_score INTEGER NOT NULL DEFAULT 0',
        'week_correct INTEGER NOT NULL DEFAULT 0',
        'week_attempts INTEGER NOT NULL DEFAULT 0',
        "week_start TEXT NOT NULL DEFAULT ''",
      ]) {
        try { this.ctx.storage.sql.exec(`ALTER TABLE leaderboard ADD COLUMN ${col}`); } catch { /* already exists */ }
      }
    });
  }

  isOptedIn(userId: string): boolean {
    const r = this.ctx.storage.sql.exec<{ opted_in: number }>(
      'SELECT opted_in FROM leaderboard WHERE user_id=?', userId).toArray()[0];
    return r?.opted_in === 1;
  }

  optIn(userId: string, displayName: string): void {
    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `INSERT INTO leaderboard(user_id,display_name,opted_in,score,correct,attempts,week_score,week_correct,week_attempts,week_start,updated_at)
       VALUES(?,?,1,0,0,0,0,0,0,'',?)
       ON CONFLICT(user_id) DO UPDATE SET opted_in=1,display_name=excluded.display_name,updated_at=excluded.updated_at`,
      userId, displayName, now);
  }

  optOut(userId: string): void {
    this.ctx.storage.sql.exec('UPDATE leaderboard SET opted_in=0 WHERE user_id=?', userId);
  }

  /**
   * Records a first-attempt answer. Only updates if the user has opted in.
   * Automatically resets weekly stats when the current week differs from stored week_start.
   */
  record(userId: string, displayName: string, difficultyWeight: number, isCorrect: boolean): void {
    if (!this.isOptedIn(userId)) return;
    const pts = isCorrect ? difficultyWeight : 0;
    const week = weekStartTaipei();
    const now = new Date().toISOString();
    const row = this.ctx.storage.sql.exec<{ week_start: string }>(
      'SELECT week_start FROM leaderboard WHERE user_id=?', userId).toArray()[0];
    const sameWeek = row?.week_start === week;
    if (sameWeek) {
      this.ctx.storage.sql.exec(
        `UPDATE leaderboard SET
           display_name=?,score=score+?,correct=correct+?,attempts=attempts+1,
           week_score=week_score+?,week_correct=week_correct+?,week_attempts=week_attempts+1,
           week_start=?,updated_at=?
         WHERE user_id=?`,
        displayName, pts, isCorrect ? 1 : 0,
        pts, isCorrect ? 1 : 0, week, now, userId);
    } else {
      // New week: reset weekly counters and start fresh.
      this.ctx.storage.sql.exec(
        `UPDATE leaderboard SET
           display_name=?,score=score+?,correct=correct+?,attempts=attempts+1,
           week_score=?,week_correct=?,week_attempts=1,
           week_start=?,updated_at=?
         WHERE user_id=?`,
        displayName, pts, isCorrect ? 1 : 0,
        pts, isCorrect ? 1 : 0, week, now, userId);
    }
  }

  count(): number {
    return this.ctx.storage.sql.exec<{ n: number }>(
      'SELECT COUNT(*) AS n FROM leaderboard WHERE opted_in=1').one().n;
  }

  top(limit = 20, weekly = false): Row[] {
    const sc = weekly ? 'week_score' : 'score';
    const co = weekly ? 'week_correct' : 'correct';
    return this.ctx.storage.sql.exec<Row>(
      `SELECT * FROM leaderboard WHERE opted_in=1 ORDER BY ${sc} DESC, ${co} DESC LIMIT ?`, limit
    ).toArray();
  }

  forUser(userId: string): Row | null {
    return this.ctx.storage.sql.exec<Row>(
      'SELECT * FROM leaderboard WHERE user_id=?', userId).toArray()[0] ?? null;
  }

  /** Fetch scores for a list of user IDs (used by group leaderboard). */
  forUsers(userIds: string[]): Row[] {
    if (!userIds.length) return [];
    const placeholders = userIds.map(() => '?').join(',');
    return this.ctx.storage.sql.exec<Row>(
      `SELECT * FROM leaderboard WHERE user_id IN (${placeholders})`, ...userIds
    ).toArray();
  }

  rankOf(userId: string, weekly = false): number {
    const sc = weekly ? 'week_score' : 'score';
    const r = this.ctx.storage.sql.exec<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM leaderboard WHERE opted_in=1 AND ${sc} > (SELECT COALESCE(${sc},0) FROM leaderboard WHERE user_id=?)`,
      userId).toArray()[0];
    return (r?.cnt ?? 0) + 1;
  }

  /** Called by the weekly Cron trigger to zero out all weekly stats. */
  resetWeek(): void {
    this.ctx.storage.sql.exec(
      `UPDATE leaderboard SET week_score=0,week_correct=0,week_attempts=0,week_start=''`);
  }
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

export async function handleRankings(
  request: Request, env: AppEnv, respond: Responder, trustedOrigin?: string
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const db = env.RANKINGS.get(env.RANKINGS.idFromName('global'));
  const total = await db.count();
  const tiersAvailable = total >= MIN_TIER_PARTICIPANTS;

  // GET /api/rankings/top — public leaderboard (top 20)
  if (pathname === '/api/rankings/top' && request.method === 'GET') {
    const weekly = url.searchParams.get('weekly') === '1';
    const rows = await db.top(20, weekly);
    return respond({
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        displayName: r.display_name,
        score: weekly ? r.week_score : r.score,
        correct: weekly ? r.week_correct : r.correct,
        attempts: weekly ? r.week_attempts : r.attempts,
        tier: tiersAvailable ? tierForScore(weekly ? r.week_score : r.score) : null,
      })),
      tiersAvailable,
      totalParticipants: total,
    });
  }

  // GET /api/rankings/me — own stats and opt-in status (requires login)
  if (pathname === '/api/rankings/me' && request.method === 'GET') {
    const session = await resolveSession(request, env);
    if (!session) return respond({ error: '請先登入' }, 401);
    const row = await db.forUser(session.user.id);
    const optedIn = row?.opted_in === 1;
    if (!optedIn) return respond({ optedIn: false, tiers: TIERS, tiersAvailable, totalParticipants: total });
    const rank = await db.rankOf(session.user.id);
    const weekRank = await db.rankOf(session.user.id, true);
    return respond({
      optedIn: true,
      score: row!.score, correct: row!.correct, attempts: row!.attempts,
      weekScore: row!.week_score, weekCorrect: row!.week_correct, weekAttempts: row!.week_attempts,
      tier: tiersAvailable ? tierForScore(row!.score) : null,
      weekTier: tiersAvailable ? tierForScore(row!.week_score) : null,
      rank, weekRank,
      tiers: TIERS, tiersAvailable, totalParticipants: total,
    });
  }

  // POST /api/rankings/join — opt in to leaderboard
  if (pathname === '/api/rankings/join' && request.method === 'POST') {
    const session = await resolveSession(request, env);
    if (!session) return respond({ error: '請先登入' }, 401);
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新登入後再試' }, 403);
    await db.optIn(session.user.id, session.user.displayName);
    return respond({ optedIn: true });
  }

  // POST /api/rankings/leave — opt out from leaderboard
  if (pathname === '/api/rankings/leave' && request.method === 'POST') {
    const session = await resolveSession(request, env);
    if (!session) return respond({ error: '請先登入' }, 401);
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新登入後再試' }, 403);
    await db.optOut(session.user.id);
    return respond({ optedIn: false });
  }

  return respond({ error: '找不到端點' }, 404);
}
