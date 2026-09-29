import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { CASES } from '../src/court-rules.ts';
const bundle=await build({stdin:{contents:"export * from './src/truth-state.ts';export {npcKnowledge} from './src/court-npc.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {buildTruthState,projectKnowledge,npcKnowledge}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const ROLES=['Judge','Prosecutor','Lawyer','Defendant','Witness'];
// Case configs differ per template (aid, ages); the projection reads only the case.
const court=caseId=>({config:{caseId}});

// Frozen copy of the pre-projection npcKnowledge facts, the regression oracle.
function legacyFacts(t,id){
 const witness=t.evidence.filter(e=>/witness|accounts/.test(e.id)||/證人|目擊|證詞/.test(e.title));
 return id==='Judge'?['請依序確認程序權利、聽取陳述、調查證據及表達意見。',t.summary]:
  id==='Witness'?(witness.length?witness.map(e=>'案件所載證詞（須依原文區分親見及轉述）：'+e.text):['本案未提供屬於我的親眼見聞，不能把其他人的說法當成我看到的。可先核對以下案件記錄：'+t.summary]):
  id==='Lawyer'?['請分清楚已知事實與推論；資料未記載的部分不能自行補足。',...t.evidence.map(e=>e.text)]:
  id==='Defendant'?t.facts.slice(0,2):[t.summary];
}

test('NPC knowledge through the projection is identical to legacy for every case and role',()=>{
 for(const t of CASES)for(const id of ROLES){
  const k=npcKnowledge(court(t.id),id);
  assert.deepEqual(k.facts.map(f=>f.text),legacyFacts(t,id),`${t.id}/${id}`);
  assert.deepEqual(Object.keys(k.sourceIds),k.facts.map(f=>f.id));
 }
});
test('answer key and unheld facts are never projected to any role',()=>{
 for(const t of CASES){
  const truth=buildTruthState(court(t.id));
  assert.ok(truth.items.some(i=>i.kind==='answer-key'));
  for(const id of ROLES){
   const text=JSON.stringify(projectKnowledge(truth,id));
   assert.ok(!text.includes('answer-key'),`${t.id}/${id}`);
   assert.ok(!text.includes(t.explanation),`${t.id}/${id} explanation`);
   for(const i of truth.items)if(!i.holders.includes(id))assert.ok(!projectKnowledge(truth,id).items.some(p=>p.sourceId===i.sourceId));
  }
 }
});
test('admitted-evidence gating limits ordinary evidence but keeps a witness own testimony',()=>{
 const t=CASES.find(c=>c.evidence.some(e=>e.id==='witness'));
 const truth=buildTruthState(court(t.id));
 const none=projectKnowledge(truth,'Lawyer',{admittedEvidenceIds:[]});
 assert.ok(!none.items.some(i=>i.sourceId.startsWith('evidence:')));
 const one=projectKnowledge(truth,'Lawyer',{admittedEvidenceIds:[t.evidence[0].id]});
 assert.deepEqual(one.items.filter(i=>i.sourceId.startsWith('evidence:')).map(i=>i.sourceId),['evidence:'+t.evidence[0].id]);
 assert.ok(projectKnowledge(truth,'Witness',{admittedEvidenceIds:[]}).items.some(i=>i.sourceId==='evidence:witness'));
});
test('truth state is immutable and projection output is a detached copy',()=>{
 const truth=buildTruthState(court(CASES[0].id));
 assert.throws(()=>{truth.items[0].text='changed';});
 assert.throws(()=>{truth.items[0].holders.push('Defendant');});
 const p=projectKnowledge(truth,'Judge');p.items[0].text='changed';
 assert.notEqual(projectKnowledge(truth,'Judge').items[0].text,'changed');
 assert.throws(()=>projectKnowledge(truth,'Administrator'));
});
