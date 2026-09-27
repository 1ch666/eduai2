// Verify the actual deployable payload, not the Unity source/Library directory.
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { gunzipSync, brotliCompressSync, constants } from 'node:zlib';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assessBuildBudget } from './build-budget.mjs';
const root = resolve(process.argv[2] || 'play');
const compareBrotli = process.argv.includes('--brotli');
const html = await readFile(join(root, 'index.html'), 'utf8');
const before = { data: 18702452, wasm: 16189274, framework: 403992, loader: 26983, touch: 0 };
const definitions = { data: /dataUrl:\s*'([^']+)'/, wasm: /codeUrl:\s*'([^']+)'/,
  framework: /frameworkUrl:\s*'([^']+)'/, loader: /loader.src\s*=\s*'([^']+)'/, touch: /<script src="(touch-controls.js)">/ };
const rows = [];
let loaderText = '';
const revisions = [];
for (const [type, regex] of Object.entries(definitions)) {
  const url = html.match(regex)?.[1];
  assert(url && /^(Build\/[\w.-]+(?:\?v=[0-9a-f]{16})?|touch-controls\.js)$/.test(url), `Safe ${type} URL required`);
  const [file, query] = url.split('?');
  if(type!=='touch')revisions.push(query?.slice(2));
  const bytes = await readFile(join(root, file));
  const compressed = file.endsWith('.unityweb');
  if (['data', 'wasm', 'framework'].includes(type)) assert(compressed, `${type} must use compression fallback`);
  const raw = compressed ? gunzipSync(bytes) : bytes;
  if (type === 'loader') loaderText = raw.toString('utf8');
  if (type === 'wasm') assert.equal(raw.subarray(0, 4).toString('hex'), '0061736d');
  if (type === 'data') assert(raw.subarray(0, 32).toString().includes('UnityWebData'));
  rows.push({ type, file: basename(file), beforeBytes: before[type], downloadBytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    decodedBytes: raw.length, brotliEstimateBytes: compareBrotli ? brotliCompressSync(raw,
      { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length : undefined });
}
assert(revisions.every(Boolean),'All four build URLs require a content-derived release revision');
{
  const inventory=rows.filter(row=>row.type!=='touch').sort((a,b)=>a.file.localeCompare(b.file))
    .map(row=>`${row.file}:${row.sha256}\n`).join('');
  const revision=createHash('sha256').update(inventory).digest('hex').slice(0,16);
  assert(revisions.every(value=>value===revision),'Every build URL must use the content hash of the same four-file release');
}
const declaredWasmSize = loaderText.match(/\bwasmFileSize\s*:\s*(\d+)/);
assert(declaredWasmSize, 'Unity loader must declare wasmFileSize');
assert.equal(Number(declaredWasmSize[1]), rows.find(row => row.type === 'wasm').decodedBytes,
  'Loader and WASM must come from the same build: decoded size mismatch');
const beforeTotal = Object.values(before).reduce((a, b) => a + b, 0);
const total = rows.reduce((n, r) => n + r.downloadBytes, 0);
const budget = assessBuildBudget(rows, JSON.parse(await readFile(new URL('../webgl-budget.json', import.meta.url), 'utf8')));
console.log(JSON.stringify({ rows, beforeTotal, downloadTotal: total, budget,
  htmlBytes: (await stat(join(root, 'index.html'))).size,
  reductionPercent: Number(((1 - total / beforeTotal) * 100).toFixed(2)),
  note: 'Brotli is an offline estimate on decoded payload, not an actual Unity Brotli build or transferred-byte trace. Total includes loader, excludes HTML, HTTP headers and cache effects.' }, null, 2));
assert(budget.passed, `WebGL download budget exceeded: ${budget.violations.join('; ')}`);
