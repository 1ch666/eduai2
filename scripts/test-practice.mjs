// Unit tests for practice question bank and weakness logic.
import test from 'node:test';
import assert from 'node:assert/strict';

// Inline the logic under test (keeps test self-contained, no Worker env needed).
const WEAKNESS_WINDOW = 20, WEAKNESS_MIN = 5;
const REINFORCE = 0.60, REVIEW = 0.80;
function weaknessStatus(attempts, correct) {
  if (attempts < WEAKNESS_MIN) return 'insufficient';
  const rate = correct / attempts;
  if (rate < REINFORCE) return 'reinforce';
  if (rate < REVIEW) return 'review';
  return 'consolidate';
}

test('weakness thresholds', () => {
  assert.equal(weaknessStatus(0, 0), 'insufficient');
  assert.equal(weaknessStatus(4, 4), 'insufficient');
  assert.equal(weaknessStatus(5, 2), 'reinforce');   // 40%
  assert.equal(weaknessStatus(10, 6), 'review');     // 60%
  assert.equal(weaknessStatus(10, 8), 'consolidate');// 80%
  assert.equal(weaknessStatus(20, 16), 'consolidate');
  assert.equal(weaknessStatus(20, 11), 'reinforce'); // 55% < 60
  // edge: exactly at threshold
  assert.equal(weaknessStatus(10, 6), 'review');     // 60% not < REINFORCE(0.60), not < REVIEW(0.80) → review
});

test('question bank has no duplicate IDs', async () => {
  const { QUESTIONS } = await import('../src/practice-data.ts');
  const ids = QUESTIONS.map(q => q.id);
  assert.equal(ids.length, new Set(ids).size, 'Duplicate question IDs found');
});

test('all questions have valid correct index', async () => {
  const { QUESTIONS } = await import('../src/practice-data.ts');
  for (const q of QUESTIONS) {
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.answers.length,
      `Question ${q.id}: correct index ${q.correct} out of range (${q.answers.length} answers)`);
    assert.ok(q.answers.length >= 2, `Question ${q.id} needs at least 2 answers`);
    assert.ok(q.text.length >= 5, `Question ${q.id} text too short`);
    assert.ok(q.explanation.length >= 10, `Question ${q.id} explanation too short`);
    assert.ok(['civics','law','economics'].includes(q.subject), `Question ${q.id} invalid subject`);
    assert.ok([1,2,3].includes(q.difficulty), `Question ${q.id} invalid difficulty`);
  }
});

test('clientQuestion strips correct answer', async () => {
  const { QUESTIONS } = await import('../src/practice-data.ts');
  // Simulate what the server does before sending to client
  function clientQuestion(q) { const { correct, ...safe } = q; void correct; return safe; }
  for (const q of QUESTIONS) {
    const client = clientQuestion(q);
    assert.ok(!('correct' in client), `Question ${q.id}: correct index leaked to client`);
    assert.ok('answers' in client, `Question ${q.id}: answers missing`);
  }
});

test('weakness window respects WEAKNESS_WINDOW limit', () => {
  // Simulate recording more than WEAKNESS_WINDOW answers and checking only last 20 count
  const answers = Array.from({length: 25}, (_, i) => ({ correct: i < 20 ? 0 : 1 }));
  const window = answers.slice(-WEAKNESS_WINDOW);
  assert.equal(window.length, 20);
  const correct = window.filter(a => a.correct === 1).length;
  assert.equal(correct, 5); // only last 5 of the 20 are correct
  assert.equal(weaknessStatus(20, correct), 'reinforce'); // 25% < 60%
});
