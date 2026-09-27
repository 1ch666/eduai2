// Reproducible local/CI gate. No deployment, credentials or live AI calls.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
function run(args) {
  console.log(`\n> node ${args.join(' ')}`);
  const result=spawnSync(process.execPath,args,{stdio:'inherit',timeout:180_000});
  if(result.error)console.error(result.error.message);
  if(result.status!==0)process.exit(result.status||1);
}
run(['scripts/copy-assets.mjs']);
run(['node_modules/wrangler/bin/wrangler.js','types']);
run(['node_modules/typescript/bin/tsc','--noEmit']);
run(['scripts/check-frontend.mjs']);
// Dictionary corpus integrity is deliberately separate: do not turn every
// frontend change into a full corpus scan. No benchmark/model calls here.
const tests=readdirSync('scripts').filter(n=>/^test-.*\.mjs$/.test(n)&&n!=='test-dictionary.mjs')
  .map(n=>`scripts/${n}`).sort();
tests.push('scripts/check-auth-sync.mjs');
tests.push(...readdirSync('court-game/tools').filter(n=>/^test-.*\.mjs$/.test(n))
  .map(n=>`court-game/tools/${n}`).sort());
run(['--test','--test-concurrency=2',...tests]);
run(['court-game/tools/check-build.mjs','play']);
