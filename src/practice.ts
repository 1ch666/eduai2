// Phase 2 practice: server-side question dispatch, scoring and weakness tracking.
// The server holds correct answers; clients only receive them after answering.
// Re-attempts and AI-hint answers are flagged; only first-attempt answers count
// toward weakness analysis and, when implemented, leaderboard rates.
import { DurableObject } from 'cloudflare:workers';
import type { AppEnv } from './env';
import { readJsonObject, type Responder } from './http';
import { resolveSession, csrfTokenMatches } from './session';
import { QUESTIONS, CONCEPTS, CONCEPT_GUIDES, type Subject } from './practice-data';

const WEAKNESS_WINDOW = 20;  // last N first-attempt answers per concept
const WEAKNESS_MIN    = 5;   // minimum attempts before rate is meaningful
const REINFORCE_THRESHOLD  = 0.60;
const REVIEW_THRESHOLD     = 0.80;

export type WeaknessStatus = 'insufficient' | 'reinforce' | 'review' | 'consolidate';
export type WeaknessStat = {
  concept: string; attempts: number; correct: number;
  rate: number; status: WeaknessStatus;
};

function weaknessStatus(attempts: number, correct: number): WeaknessStatus {
  if (attempts < WEAKNESS_MIN) return 'insufficient';
  const rate = correct / attempts;
  if (rate < REINFORCE_THRESHOLD) return 'reinforce';
  if (rate < REVIEW_THRESHOLD) return 'review';
  return 'consolidate';
}

export class Practice extends DurableObject<AppEnv> {
  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS answers (
          id TEXT PRIMARY KEY,
          question_id TEXT NOT NULL,
          concept TEXT NOT NULL,
          first_attempt INTEGER NOT NULL DEFAULT 1,
          correct INTEGER NOT NULL,
          answered_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS answers_concept ON answers(concept, answered_at DESC);
        CREATE TABLE IF NOT EXISTS pending (
          token TEXT PRIMARY KEY,
          question_id TEXT NOT NULL,
          issued_at INTEGER NOT NULL
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

  /** Expire pending question tokens older than 10 minutes. */
  private purgePending(): void {
    this.ctx.storage.sql.exec('DELETE FROM pending WHERE issued_at < ?', Date.now() - 600_000);
  }

  issuePending(token: string, questionId: string): void {
    this.purgePending();
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO pending VALUES(?,?,?)', token, questionId, Date.now());
  }

  consumePending(token: string): string | null {
    const row = this.ctx.storage.sql
      .exec<{ question_id: string }>('SELECT question_id FROM pending WHERE token = ?', token)
      .toArray()[0];
    if (!row) return null;
    this.ctx.storage.sql.exec('DELETE FROM pending WHERE token = ?', token);
    return row.question_id;
  }

  isFirstAttempt(questionId: string): boolean {
    return this.ctx.storage.sql
      .exec<{ n: number }>('SELECT count(*) AS n FROM answers WHERE question_id = ?', questionId)
      .one().n === 0;
  }

  record(id: string, questionId: string, concept: string, firstAttempt: boolean, correct: boolean): void {
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO answers VALUES(?,?,?,?,?,?)',
      id, questionId, concept, firstAttempt ? 1 : 0, correct ? 1 : 0, new Date().toISOString());
  }

  weakness(): WeaknessStat[] {
    return CONCEPTS.map(concept => {
      const rows = this.ctx.storage.sql
        .exec<{ correct: number }>(
          `SELECT correct FROM answers WHERE concept = ? AND first_attempt = 1
           ORDER BY answered_at DESC LIMIT ?`, concept, WEAKNESS_WINDOW)
        .toArray();
      const attempts = rows.length;
      const correct  = rows.filter(r => r.correct === 1).length;
      return { concept, attempts, correct, rate: attempts ? correct / attempts : 0,
               status: weaknessStatus(attempts, correct) };
    }).filter(s => s.attempts > 0);
  }

  /** Pick a concept to practice: reinforce > review > consolidate > random. */
  priorityConcept(): string | null {
    const stats = this.weakness();
    for (const status of ['reinforce', 'review', 'consolidate'] as WeaknessStatus[]) {
      const match = stats.find(s => s.status === status);
      if (match) return match.concept;
    }
    return null;
  }
}

// ── HTTP handlers ────────────────────────────────────────────────────────────

/** Strip correct answer before sending to client. */
function clientQuestion(q: typeof QUESTIONS[0]) {
  const { correct, ...safe } = q;
  void correct;
  return safe;
}

export async function handlePractice(
  request: Request, env: AppEnv, respond: Responder, trustedOrigin?: string
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const session = await resolveSession(request, env);
  if (!session) return respond({ error: '請登入才能使用題目練習功能' }, 401);

  const practice = env.PRACTICE.getByName(session.user.id);

  // GET /api/practice/questions — server picks a question, issues a one-time token
  if (pathname === '/api/practice/questions' && request.method === 'GET') {
    if (!practice.allow('questions', 60)) return respond({ error: '取題太頻繁，請稍候' }, 429);

    const params = new URL(request.url).searchParams;
    const subjectParam = params.get('subject') as Subject | null;
    const conceptParam = params.get('concept');

    // Filter pool
    let pool = QUESTIONS.filter(q =>
      (!subjectParam || q.subject === subjectParam) &&
      (!conceptParam || q.concept === conceptParam)
    );
    if (!pool.length) pool = QUESTIONS;

    // Prefer weak concept if no explicit filter
    if (!conceptParam) {
      const weak = await practice.priorityConcept();
      if (weak) pool = QUESTIONS.filter(q => q.concept === weak && (!subjectParam || q.subject === subjectParam));
      if (!pool.length) pool = QUESTIONS.filter(q => !subjectParam || q.subject === subjectParam);
    }

    const q = pool[Math.floor(Math.random() * pool.length)];
    const token = crypto.randomUUID();
    await practice.issuePending(token, q.id);
    return respond({ questionToken: token, question: clientQuestion(q) });
  }

  // POST /api/practice/answer — score server-side, record weakness
  if (pathname === '/api/practice/answer' && request.method === 'POST') {
    if (!trustedOrigin || !csrfTokenMatches(request, session)) return respond({ error: '請重新整理頁面後再試' }, 403);
    if (!practice.allow('answer', 120)) return respond({ error: '答題太頻繁，請稍候' }, 429);

    const body = await readJsonObject(request, 512, respond, '答題資料過長');
    if (body.error) return body.error;
    const { questionToken, answer } = body.value;

    if (typeof questionToken !== 'string' || !/^[0-9a-f-]{36}$/.test(questionToken)) {
      return respond({ error: '答題憑證格式錯誤' }, 400);
    }
    if (!Number.isInteger(answer)) return respond({ error: '答案需為整數索引' }, 400);
    const answerIdx = answer as number;

    const questionId = await practice.consumePending(questionToken);
    if (!questionId) return respond({ error: '答題憑證不存在或已過期，請重新取題' }, 409);

    const q = QUESTIONS.find(q => q.id === questionId);
    if (!q) return respond({ error: '題目不存在' }, 404);

    if (answerIdx < 0 || answerIdx >= q.answers.length) return respond({ error: '答案索引超出範圍' }, 400);

    const firstAttempt = await practice.isFirstAttempt(questionId);
    const correct = answerIdx === q.correct;
    await practice.record(crypto.randomUUID(), questionId, q.concept, firstAttempt, correct);

    const weakness = await practice.weakness();
    return respond({
      correct,
      correctIndex: q.correct,
      explanation: q.explanation,
      source: q.source,
      firstAttempt,
      weakness: weakness.find(s => s.concept === q.concept) ?? null
    });
  }

  // GET /api/practice/weakness — per-concept weakness summary
  if (pathname === '/api/practice/weakness' && request.method === 'GET') {
    const weakness = await practice.weakness();
    // Enrich each stat with subject so the client can pre-fill the planner form.
    const enriched = weakness.map(s => {
      const q = QUESTIONS.find(q => q.concept === s.concept);
      return { ...s, subject: q?.subject ?? 'other' };
    });
    return respond({
      weakness: enriched,
      windowSize: WEAKNESS_WINDOW,
      minAttempts: WEAKNESS_MIN,
      thresholds: { reinforce: REINFORCE_THRESHOLD, review: REVIEW_THRESHOLD }
    });
  }

  // GET /api/practice/reinforce — return guide + next question for a weak concept
  if (pathname === '/api/practice/reinforce' && request.method === 'GET') {
    const conceptParam = new URL(request.url).searchParams.get('concept');
    const weakness = await practice.weakness();

    // Pick concept: explicit param → weakest reinforce → weakest review → any with data
    let targetConcept = conceptParam;
    if (!targetConcept) {
      const priority = ['reinforce','review','consolidate'] as WeaknessStatus[];
      for (const status of priority) {
        const match = weakness.find(s => s.status === status);
        if (match) { targetConcept = match.concept; break; }
      }
    }
    if (!targetConcept) return respond({ guide: null, questionToken: null, question: null, message: '尚無練習紀錄；請先作答幾題再使用補強功能。' });

    const guide = CONCEPT_GUIDES[targetConcept] ?? null;
    const pool = QUESTIONS.filter(q => q.concept === targetConcept);
    if (!pool.length) return respond({ guide, questionToken: null, question: null });

    const q = pool[Math.floor(Math.random() * pool.length)];
    const token = crypto.randomUUID();
    await practice.issuePending(token, q.id);
    const stat = weakness.find(s => s.concept === targetConcept) ?? null;
    return respond({ guide, stat, questionToken: token, question: clientQuestion(q) });
  }

  return respond({ error: '找不到端點' }, 404);
}
