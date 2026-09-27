import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('build gate rejects missing, mixed, unsafe and stale resource revisions', async()=>{
  const root=await mkdtemp(join(tmpdir(),'eduai-build-revision-'));
  try {
    await mkdir(join(root,'Build'));
    const files={
      'WebGL.data.unityweb':gzipSync(Buffer.from('UnityWebData fixture')),
      'WebGL.framework.js.unityweb':gzipSync(Buffer.from('fixture')),
      'WebGL.loader.js':Buffer.from('const sizes={wasmFileSize:8}'),
      'WebGL.wasm.unityweb':gzipSync(Buffer.from('0061736d01000000','hex'))
    };
    for(const [name,data] of Object.entries(files))await writeFile(join(root,'Build',name),data);
    await writeFile(join(root,'touch-controls.js'),'fixture');
    const inventory=Object.entries(files).map(([name,data])=>`${name}:${createHash('sha256').update(data).digest('hex')}\n`).join('');
    const revision=createHash('sha256').update(inventory).digest('hex').slice(0,16);
    const html=q=>`<script src="touch-controls.js"></script><script>loader.src = 'Build/WebGL.loader.js${q}'; const config={dataUrl: 'Build/WebGL.data.unityweb${q}', frameworkUrl: 'Build/WebGL.framework.js.unityweb${q}', codeUrl: 'Build/WebGL.wasm.unityweb${q}'};</script>`;
    const run=async text=>{
      await writeFile(join(root,'index.html'),text);
      return spawnSync(process.execPath,[fileURLToPath(new URL('./check-build.mjs',import.meta.url)),root],{encoding:'utf8'});
    };
    assert.equal((await run(html('?v='+revision))).status,0);
    assert.notEqual((await run(html(''))).status,0);
    assert.notEqual((await run(html('?v=0000000000000000'))).status,0);
    assert.notEqual((await run(html('?v='+revision).replace('WebGL.loader.js?v='+revision,'WebGL.loader.js'))).status,0);
    assert.notEqual((await run(html('?v=../../other'))).status,0);
  } finally { await rm(root,{recursive:true,force:true}); }
});
