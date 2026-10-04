import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const name='基於角色隔離多智能體與 3D 模擬法庭的 AI 法治教育平台';
const english='A Role-Bounded Multi-Agent Legal Education Platform with a 3D Interactive Mock Court';
test('site names agree across home, learning pages, sharing metadata and install manifest',async()=>{
 const home=await readFile('index.html','utf8');
 assert.ok(home.includes(`<title>${name}</title>`));
 assert.ok(home.includes(`<small>${english}</small>`));
 const structured=JSON.parse(home.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
 assert.equal(structured.name,name);assert.equal(structured.alternateName,english);
 for(const file of ['index.html','court/index.html','practice/index.html','planner/index.html','rankings/index.html','photo/index.html','groups/index.html']){
  const text=await readFile(file,'utf8');assert.ok(text.includes(name),file);assert.ok(!text.includes('公民法律研究室'),file);
 }
 const manifest=JSON.parse(await readFile('manifest.json','utf8'));assert.equal(manifest.name,name);assert.equal(manifest.short_name,'EduAI2');
});
