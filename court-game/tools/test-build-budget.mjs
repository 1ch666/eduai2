import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessBuildBudget } from './build-budget.mjs';
const budget = JSON.parse(await readFile(new URL('../webgl-budget.json', import.meta.url), 'utf8'));
const baseline = () => Object.entries(budget.baselineBytes).map(([type, downloadBytes]) => ({type, downloadBytes}));
test('published baseline fits and reports its exact commit and total', () => {
  const result = assessBuildBudget(baseline(), budget);
  assert.equal(result.passed, true); assert.equal(result.baselineTotal, 21275667);
  assert.equal(result.growthPercent, 0); assert.equal(result.baselineCommit, budget.baselineCommit);
});
test('small asset bloat cannot hide under a large total budget', () => {
  const rows = baseline(); rows.find(r => r.type === 'touch').downloadBytes *= 2;
  const result = assessBuildBudget(rows, budget);
  assert.equal(result.passed, false); assert.equal(result.violations.length, 1);
  assert.match(result.violations[0], /^touch:/);
});
test('aggregate growth rejects even when each individual asset is within its limit', () => {
  const rows = baseline().map(r => ({...r, downloadBytes: Math.floor(r.downloadBytes * 1.15)}));
  const result = assessBuildBudget(rows, budget);
  assert.equal(result.passed, false); assert.equal(result.violations.length, 1);
  assert.match(result.violations[0], /^total:/);
});
test('inclusive total boundary passes and next byte fails', () => {
  const rows = baseline(); const extra = Math.floor(21275667 * 1.1) - 21275667;
  rows[0].downloadBytes += extra;
  assert.equal(assessBuildBudget(rows, budget).passed, true);
  rows[0].downloadBytes++;
  assert.equal(assessBuildBudget(rows, budget).passed, false);
});
test('missing, duplicate, unsafe or invalid measurements never produce green result', () => {
  assert.throws(() => assessBuildBudget(baseline().slice(1), budget));
  const duplicate = baseline(); duplicate[0] = {...duplicate[1]};
  assert.throws(() => assessBuildBudget(duplicate, budget));
  for (const value of [NaN, Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const rows = baseline(); rows[0].downloadBytes = value;
    assert.throws(() => assessBuildBudget(rows, budget));
  }
  assert.throws(() => assessBuildBudget(baseline(), {...budget, maxTotalGrowthPercent: NaN}));
});
