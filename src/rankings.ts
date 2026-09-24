// Phase 3: global leaderboard and tier (段位) system.
// One global Rankings DO holds cross-user aggregated stats.
// Score = sum of difficulty-weighted correct first-attempt answers.
// Tier thresholds: 見習生 0, 初學者 50, 進階者 150, 熟練者 300, 專家 500.
import { DurableObject } from 'cloudflare:workers';
import type { AppEnv } from './env';
import type { Responder } from './http';
import { resolveSession } from './session';

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

type LeaderboardRow = { user_id: string; display_name: string; score: number; correct: number; attempts: number; updated_at: string };

export class Rankings extends DurableObject<AppEnv> {
  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          user_id     TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          score       INTEGER NOT NULL DEFAULT 0,
          correct     INTEGER NOT NULL DEFAULT 0,
          attempts    INTEGER NOT NULL DEFAULT 0,
          updated_at  TEXT NOT NULL
        );
      `);
    });
  }

  // Called by practice handler after recording a first-attempt answer.
  record(userId: string, displayName: string, difficultyWeight: number, isCorrect: boolean): void {
    const points = isCorrect ? difficultyWeight : 0;
    this.ctx.storage.sql.exec(
      `INSERT INTO leaderboard(user_id, display_name, score, correct, attempts, updated_at)
         VALUES(?,?,?,?,1,?)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         score        = leaderboard.score + excluded.score,
         correct      = leaderboard.correct + excluded.correct,
         attempts     = leaderboard.attempts + 1,
         updated_at   = excluded.updated_at`,
      userId, displayName, points, isCorrect ? 1 : 0, new Date().toISOString()
    );
  }

  top(limit = 20): LeaderboardRow[] {
    return this.ctx.storage.sql.exec<LeaderboardRow>(
      'SELECT * FROM leaderboard ORDER BY score DESC, correct DESC LIMIT ?', limit
    ).toArray();
  }

  forUser(userId: string): LeaderboardRow | null {
    const rows = this.ctx.storage.sql.exec<LeaderboardRow>(
      'SELECT * FROM leaderboard WHERE user_id=?', userId
    ).toArray();
    return rows[0] ?? null;
  }

  // Returns rank position (1-based) of the given user.
  rankOf(userId: string): number {
    const rows = this.ctx.storage.sql.exec<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM leaderboard WHERE score > (SELECT COALESCE(score,0) FROM leaderboard WHERE user_id=?)`,
      userId
    ).toArray();
    return (rows[0]?.cnt ?? 0) + 1;
  }
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

export async function handleRankings(
  request: Request, env: AppEnv, respond: Responder
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const store = env.RANKINGS;
  const rankings = store.get(store.idFromName('global'));

  // GET /api/rankings/top — public leaderboard (top 20)
  if (pathname === '/api/rankings/top' && request.method === 'GET') {
    const rows = await rankings.top(20);
    return respond({
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        displayName: r.display_name,
        score: r.score,
        correct: r.correct,
        attempts: r.attempts,
        tier: tierForScore(r.score),
      }))
    });
  }

  // GET /api/rankings/me — own rank + tier (requires login)
  if (pathname === '/api/rankings/me' && request.method === 'GET') {
    const session = await resolveSession(request, env);
    if (!session) return respond({ error: '請先登入' }, 401);
    const row = await rankings.forUser(session.user.id);
    if (!row) return respond({ score: 0, correct: 0, attempts: 0, tier: '見習生', rank: null });
    const rank = await rankings.rankOf(session.user.id);
    return respond({
      score: row.score,
      correct: row.correct,
      attempts: row.attempts,
      tier: tierForScore(row.score),
      rank,
      tiers: TIERS,
    });
  }

  return respond({ error: '找不到端點' }, 404);
}
