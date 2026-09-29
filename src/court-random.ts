import { AGE_LIMITS, AIDS, CASES, rolesFor, validateConfig, type CaseTemplate, type CourtConfig } from './court-rules';

// "Fully random" means the server picks the legal structure. The model later
// only writes narrative for the chosen template; it never sees or sets config.
export const MAX_RANDOM_CONFIG_ATTEMPTS = 20;
/** Presentation spread between act and hearing age, not a legal rule. */
const HEARING_GAP_MAX = 2;

export class RandomConfigError extends Error {
  readonly code = 'INTERNAL_CONFIG_ERROR';
  constructor() { super('無法產生合法的隨機案件設定，請稍後再試。'); }
}

/** Unbiased index from the platform CSPRNG (rejection sampling, no Math.random). */
export function randomIndex(n: number): number {
  if (!Number.isInteger(n) || n < 1) throw RangeError('empty range');
  const limit = Math.floor(0x100000000 / n) * n, buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= limit);
  return buffer[0] % n;
}
const pick = <T>(items: readonly T[]): T => items[randomIndex(items.length)];
const between = (min: number, max: number) => min + randomIndex(max - min + 1);

// Same balancing as randomLibraryCase: least used first, avoid an immediate repeat.
export function pickBaseTemplate(recentCaseIds: readonly string[]): CaseTemplate {
  const counts = new Map(CASES.map(t => [t.id, recentCaseIds.filter(id => id === t.id).length]));
  const minimum = Math.min(...counts.values());
  let candidates = CASES.filter(t => counts.get(t.id) === minimum);
  const last = recentCaseIds.filter(id => counts.has(id)).at(-1);
  const withoutLast = candidates.filter(t => t.id !== last); if (withoutLast.length) candidates = withoutLast;
  return pick(candidates);
}

function configFor(t: CaseTemplate, validate: (c: CourtConfig) => string | null): CourtConfig | null {
  // Age ranges come from AGE_LIMITS; role and aid legality come from validateConfig
  // itself, so there is no second copy of the rules to drift out of sync.
  const limits = AGE_LIMITS[t.procedure];
  const party = () => { const act = between(limits.actMin, limits.actMax); return [act, between(act, Math.min(limits.actMax, act + HEARING_GAP_MAX))]; };
  const [claimantAge, claimantHearingAge] = party(), [respondentAge, respondentHearingAge] = party();
  const options = rolesFor(t.procedure).map(role => AIDS.flatMap(claimantAid => AIDS.map(respondentAid =>
    ({ caseId: t.id, role, claimantAge, claimantHearingAge, respondentAge, respondentHearingAge, claimantAid, respondentAid }) as CourtConfig))
    .filter(c => validate(c) === null)).filter(list => list.length);
  // Uniform over playable roles first, then over that role's legal assistance.
  return options.length ? pick(pick(options)) : null;
}

export function randomCourtConfig(recentCaseIds: readonly string[] = [], validate: (c: CourtConfig) => string | null = validateConfig): CourtConfig {
  for (let attempt = 0; attempt < MAX_RANDOM_CONFIG_ATTEMPTS; attempt++) {
    const config = configFor(pickBaseTemplate(recentCaseIds), validate);
    // Never trust our own generator: the final config passes the same gate as client input.
    if (config && validate(config) === null) return config;
  }
  throw new RandomConfigError();
}

/** Only a request key and an AI preference; anything that could steer the draw is rejected. */
export function parseRandomCaseRequest(body: Record<string, unknown>): { requestId: string; preferAi: boolean } | { error: string } {
  if (Object.keys(body).some(k => k !== 'requestId' && k !== 'preferAi')) return { error: '完全隨機案件由伺服器決定案件、程序、角色、年齡與法律協助，不接受指定。' };
  if (typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/.test(body.requestId)) return { error: '缺少請求識別' };
  if (body.preferAi !== undefined && typeof body.preferAi !== 'boolean') return { error: 'AI 偏好格式錯誤' };
  return { requestId: body.requestId, preferAi: body.preferAi !== false };
}
