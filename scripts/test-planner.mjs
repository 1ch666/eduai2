// Unit tests for planner input validation logic (no Worker env needed).
import test from 'node:test';
import assert from 'node:assert/strict';

function validIso(s) {
  if (typeof s !== 'string') return false;
  const d = new Date(s); return !isNaN(d.getTime());
}
function parseSlotInput(b) {
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 80) return '標題格式錯誤';
  if (!validIso(b.startIso)) return '開始時間格式錯誤';
  if (!validIso(b.endIso))   return '結束時間格式錯誤';
  if (new Date(b.endIso) <= new Date(b.startIso)) return '結束時間須晚於開始時間';
  const dur = (new Date(b.endIso) - new Date(b.startIso)) / 60000;
  if (dur > 60 * 24) return '單一排程不能超過 24 小時';
  if (!['none','weekly'].includes(b.recurrence)) return '重複規則需為 none 或 weekly';
  if (b.examDate !== undefined && b.examDate !== null && !validIso(b.examDate)) return '考試日期格式錯誤';
  return { ok: true };
}

test('valid slot passes', () => {
  const r = parseSlotInput({ title:'數學複習', startIso:'2026-10-01T10:00:00Z', endIso:'2026-10-01T11:00:00Z', recurrence:'none' });
  assert.deepEqual(r, { ok: true });
});
test('end before start rejects', () => {
  const r = parseSlotInput({ title:'A', startIso:'2026-10-01T12:00:00Z', endIso:'2026-10-01T10:00:00Z', recurrence:'none' });
  assert.equal(typeof r, 'string');
});
test('duration over 24h rejects', () => {
  const r = parseSlotInput({ title:'A', startIso:'2026-10-01T00:00:00Z', endIso:'2026-10-03T01:00:00Z', recurrence:'none' });
  assert.equal(typeof r, 'string');
});
test('invalid recurrence rejects', () => {
  const r = parseSlotInput({ title:'A', startIso:'2026-10-01T10:00:00Z', endIso:'2026-10-01T11:00:00Z', recurrence:'daily' });
  assert.equal(typeof r, 'string');
});
test('weekly recurrence passes', () => {
  const r = parseSlotInput({ title:'A', startIso:'2026-10-01T10:00:00Z', endIso:'2026-10-01T11:00:00Z', recurrence:'weekly' });
  assert.deepEqual(r, { ok: true });
});
test('invalid examDate rejects', () => {
  const r = parseSlotInput({ title:'A', startIso:'2026-10-01T10:00:00Z', endIso:'2026-10-01T11:00:00Z', recurrence:'none', examDate:'not-a-date' });
  assert.equal(typeof r, 'string');
});
test('null examDate is allowed (means no exam marker)', () => {
  const r = parseSlotInput({ title:'A', startIso:'2026-10-01T10:00:00Z', endIso:'2026-10-01T11:00:00Z', recurrence:'none', examDate: null });
  assert.deepEqual(r, { ok: true });
});
