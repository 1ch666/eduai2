import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(html.slice(html.indexOf('    function parseProgressExport('),html.indexOf('    function applyProgress(')),context);
const parse=context.parseProgressExport;
const good=()=>({format:'eduai-personal-progress',version:1,ranked:true,records:[{scope:'civics',payload:{solved:['q1','q1'],score:1,admin:true}}]});
test('Imported records are projected, deduplicated, always self-reported',()=>{
 const result=JSON.parse(JSON.stringify(parse(good())));
 assert.deepEqual(result,[{scope:'civics',payload:{solved:['q1'],score:1},selfReported:true}]);
});
test('Reject malformed imports, unsupported versions, excessive IDs and scores',()=>{
 for(const data of [null,{}, {...good(),version:2}, {...good(),records:[...good().records,...good().records]}, {...good(),records:[{scope:'admin',payload:{}}]}])assert.throws(()=>parse(data));
 for(const solved of [new Array(501).fill('q'),[{}],['x'.repeat(121)],[-1]]){const d=good();d.records[0].payload.solved=solved;assert.throws(()=>parse(d));}
 for(const score of [-1,Infinity,'100',1000001]){const d=good();d.records[0].payload.score=score;assert.throws(()=>parse(d));}
});
