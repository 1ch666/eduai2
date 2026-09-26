import type { AppEnv } from './env';
import { readTextWithLimit, sha256Hex } from './http';

export type DictionaryEntry = {
  id: string; word: string; source: string; source_url: string; version: string;
  readings: { pronunciation: { bopomofo: string; pinyin: string }; part_of_speech: string[]; definitions: string[]; examples: string[] }[];
};

// Deliberately narrow: a case question such as「你看到了甚麼」is NOT a word lookup.
export function dictionaryTerm(question: string): string | null {
  const q = question.trim().replace(/[？?。！!]+$/u, '');
  const match = q.match(/^(?:請問)?(?:什麼|甚麼)是[「『"]?(.+?)[」』"]?$/u)
    || q.match(/^(?:請問)?[「『"]?(.+?)[」』"]?(?:是(?:什麼|甚麼)(?:意思)?|的意思(?:是(?:什麼|甚麼))?|的定義)$/u)
    || q.match(/^(?:查字典|查詞|詞義)[：: ]+(.+)$/u);
  const word = match?.[1].trim();
  return word && /^[\p{Script=Han}]{1,20}$/u.test(word) ? word : null;
}

// One entry per embedding document, including all pronunciations and meanings.
// This prepares text only: no embedding provider is enabled or called.
export function dictionaryEmbeddingText(entry: DictionaryEntry): string {
  return [entry.word, ...entry.readings.flatMap(r => [
    `注音：${r.pronunciation.bopomofo}`, `拼音：${r.pronunciation.pinyin}`,
    `詞性：${r.part_of_speech.join('、')}`, ...r.definitions.map(d => `釋義：${d}`),
    ...r.examples.map(e => `例句：${e}`),
  ])].join('\n');
}

export async function lookupDictionary(env: Pick<AppEnv, 'ASSETS'>, question: string): Promise<DictionaryEntry | null> {
  const word = dictionaryTerm(question);
  if (!word || !env.ASSETS) return null;
  try {
    const bucket = (await sha256Hex(word)).slice(0, 2);
    // Fixed asset origin/path, never a user-supplied URL. Only one shard per request.
    const res = await env.ASSETS.fetch(new Request(`https://dictionary.internal/rag/moe-revised/${bucket}.jsonl.gz`));
    if (!res.ok || !res.body) return null;
    const raw = await readTextWithLimit(res.body.pipeThrough(new DecompressionStream('gzip')), 4_000_000);
    if (raw.tooLarge || raw.invalidEncoding) return null;
    for (const line of raw.text.split('\n')) {
      if (!line) continue;
      const entry: DictionaryEntry = JSON.parse(line);
      if (entry.word === word && Array.isArray(entry.readings)) return entry;
    }
  } catch { /* Missing/corrupt corpus must not disable normal tutoring. */ }
  return null;
}

export function dictionaryAnswer(entry: DictionaryEntry): string {
  return [
    `【辭典原文】${entry.word}`,
    ...entry.readings.map(r => [r.pronunciation.bopomofo, r.pronunciation.pinyin, ...r.definitions].join('\n')),
    `來源：中華民國教育部（Ministry of Education, R.O.C.）。《重編國語辭典修訂本》（版本編號：${entry.version}）`,
    entry.source_url, '授權：CC BY-ND 3.0 TW。辭典詞義不是本案事實，也不等同法律上的專門定義。',
  ].join('\n\n');
}
