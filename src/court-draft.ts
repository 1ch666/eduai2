// Pure validation of the existing narrative-only generation contract. IDs,
// procedure, legal eligibility and answer keys are never accepted from a model.
export interface CourtNarrativeDraft {
  title: string;
  summary: string;
  facts: string[];
  evidence: {title: string; text: string}[];
}

function record(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor && descriptor.enumerable;
  });
}

const clean = (v: unknown, max: number): v is string => typeof v === 'string' &&
  v.trim().length >= 4 && v.length <= max &&
  !/[<>]|https?:|第[零一二三四五六七八九十百千\d]+條|判處|判決有罪/.test(v);

export function parseCourtNarrativeDraft(value: unknown): CourtNarrativeDraft | null {
  if (!record(value, ['title', 'summary', 'facts', 'evidence']) ||
      !clean(value.title, 60) || !clean(value.summary, 260) ||
      !Array.isArray(value.facts) || value.facts.length < 3 || value.facts.length > 6 ||
      !Array.isArray(value.evidence) || value.evidence.length < 2 || value.evidence.length > 4) return null;
  const facts: string[] = [];
  // Array.every skips holes; indexed validation must reject missing entries.
  for (let i = 0; i < value.facts.length; i++) {
    const item = Object.getOwnPropertyDescriptor(value.facts, String(i));
    if (!item || !('value' in item) || !clean(item.value, 220)) return null;
    facts.push(item.value);
  }
  const evidence: CourtNarrativeDraft['evidence'] = [];
  for (let i = 0; i < value.evidence.length; i++) {
    const item = Object.getOwnPropertyDescriptor(value.evidence, String(i));
    if (!item || !('value' in item) || !record(item.value, ['title', 'text'])) return null;
    const e = item.value;
    if (!clean(e.title, 60) || !clean(e.text, 300)) return null;
    evidence.push({title: e.title, text: e.text});
  }
  return {title: value.title, summary: value.summary, facts, evidence};
}
