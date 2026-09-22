import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const canonical = 'https://1ch666.github.io/eduai2/';
assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
assert.ok(html.includes('name="description"'));
assert.ok(html.includes('property="og:url"'));
assert.ok(html.includes('lang="zh-Hant"'));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
// Only static markup: templates inside JS may intentionally use the same IDs.
const markup = html.split('<script src=')[0];
const staticIds = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(staticIds).size, staticIds.length, 'Duplicate static IDs');
for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (match[1].includes('application/ld+json')) {
    assert.equal(JSON.parse(match[2]).url, canonical);
  } else if (!match[1].includes('src=')) new vm.Script(match[2]);
}
for (const file of ['styles.css', 'favicon.svg', 'robots.txt', 'sitemap.xml']) {
  await access(new URL(`../public/${file}`, import.meta.url));
}
const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');
assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
assert.ok(ids.includes('mainContent'));
console.log('Frontend checks passed: script syntax, metadata, schema, IDs and built assets.');
