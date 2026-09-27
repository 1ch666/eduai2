import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCourtNarrativeDraft as parse} from '../src/court-draft.ts';

const draft=()=>({title:'虛構器材爭議',summary:'雙方對器材交還過程有不同說法。',
 facts:['甲方交付器材進行檢測。','乙方表示曾經測試器材。','交還後故障原因仍待查證。'],
 evidence:[{title:'收件檢測紀錄',text:'確認簽收，但沒有完整檢測結果。'},
 {title:'返還對話紀錄',text:'確認交還，但沒有提及是否能啟動。'}]});

test('pure draft validation is repeatable, does not mutate or retain references',()=>{
 const input=draft(),before=structuredClone(input),a=parse(input),b=parse(input);
 assert.deepEqual(a,b);assert.deepEqual(input,before);
 a.facts[0]='changed';a.evidence[0].text='changed';assert.deepEqual(input,before);
 assert.deepEqual(parse(input),b);
 assert.deepEqual(parse(Object.assign(Object.create(null),input)),b);
});

test('rejects missing/extra authority fields, sparse arrays, inherited values and accessors',()=>{
 for(const key of Object.keys(draft())){const value=draft();delete value[key];assert.equal(parse(value),null);}
 for(const key of ['id','procedure','correct','sources','roles','stage','__proto__']){
  const value=draft();Object.defineProperty(value,key,{value:'injected',enumerable:true});assert.equal(parse(value),null);
 }
 const sparse=draft();delete sparse.facts[1];assert.equal(parse(sparse),null);
 const sparseEvidence=draft();delete sparseEvidence.evidence[0];assert.equal(parse(sparseEvidence),null);
 assert.equal(parse(Object.create(draft())),null);
 const getter=draft();Object.defineProperty(getter,'title',{get(){throw Error('must not execute');}});
 assert.equal(parse(getter),null);
 const nested=draft();Object.defineProperty(nested.evidence[0],'text',{get(){throw Error('must not execute');}});
 assert.equal(parse(nested),null);
});

test('bounded malformed corpus rejects invalid values at every narrative position',()=>{
 const bad=[null,undefined,0,false,{},[],NaN,'','   ','短','x'.repeat(301),'<script>evil</script>','依第123條判決有罪'];
 for(const value of bad){
  assert.equal(parse(value),null);
  for(const key of ['title','summary'])assert.equal(parse({...draft(),[key]:value}),null);
  for(let i=0;i<3;i++){const d=draft();d.facts[i]=value;assert.equal(parse(d),null);}
  for(const key of ['title','text'])for(let i=0;i<2;i++){
   const d=draft();d.evidence[i][key]=value;assert.equal(parse(d),null);
  }
 }
 for(const [key,min,max] of [['facts',3,6],['evidence',2,4]]){
  const original=draft()[key][0];
  for(const length of [0,min-1,max+1])assert.equal(parse({...draft(),[key]:Array(length).fill(original)}),null);
 }
});
