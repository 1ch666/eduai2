import assert from 'node:assert/strict';

const types = ['data', 'wasm', 'framework', 'loader', 'touch'];
export function assessBuildBudget(rows, budget) {
  assert.equal(budget?.schemaVersion, 1, 'Unsupported build budget version');
  assert.match(budget.baselineCommit, /^[a-f0-9]{40}$/, 'Baseline must identify a source commit');
  for (const key of ['maxTotalGrowthPercent', 'maxAssetGrowthPercent'])
    assert(Number.isFinite(budget[key]) && budget[key] >= 0 && budget[key] <= 100, `Invalid ${key}`);
  assert(Array.isArray(rows) && rows.length === types.length, 'All five payload types are required');
  assert.equal(new Set(rows.map(r => r.type)).size, types.length, 'Duplicate payload type');
  let total = 0, baselineTotal = 0;
  const violations = [];
  for (const type of types) {
    const row = rows.find(r => r.type === type), baseline = budget.baselineBytes[type];
    assert(row && Number.isSafeInteger(row.downloadBytes) && row.downloadBytes > 0, `Invalid ${type} bytes`);
    assert(Number.isSafeInteger(baseline) && baseline > 0, `Invalid ${type} baseline`);
    total += row.downloadBytes; baselineTotal += baseline;
    const limit = Math.floor(baseline * (1 + budget.maxAssetGrowthPercent / 100));
    if (row.downloadBytes > limit) violations.push(`${type}: ${row.downloadBytes} > ${limit} bytes`);
  }
  const totalLimit = Math.floor(baselineTotal * (1 + budget.maxTotalGrowthPercent / 100));
  if (total > totalLimit) violations.push(`total: ${total} > ${totalLimit} bytes`);
  return { baselineCommit: budget.baselineCommit, baselineTotal, totalLimit,
    growthPercent: Number(((total / baselineTotal - 1) * 100).toFixed(3)),
    passed: violations.length === 0, violations };
}
