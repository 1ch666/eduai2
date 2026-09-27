import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEmbeddingOutput,parseRerankOutput} from '../src/providers/validation.ts';
const usage=()=>({inputTokens:3,outputTokens:null});
const embedding=()=>({vectors:[[.1,-.5,0],[1,2,3]],usage:usage()});
const ranking=()=>({items:[{id:'a',score:3},{id:'b',score:-2}],usage:usage()});

test('validated outputs are copies and do not share nested provider objects',()=>{
  const raw=embedding(), parsed=parseEmbeddingOutput(raw,2,3);
  assert.deepEqual(parsed,raw);raw.vectors[0][0]=99;raw.usage.inputTokens=99;
  assert.equal(parsed.vectors[0][0],.1);assert.equal(parsed.usage.inputTokens,3);
  const r=ranking(),p=parseRerankOutput(r,['a','b','c'],2);
  assert.deepEqual(p,r);r.items[0].id='private';assert.equal(p.items[0].id,'a');
});

test('embedding count, dimensions, total size, finite scalars and exact shape are enforced',()=>{
  for(const [count,dimensions] of [[0,3],[2,0],[33,3],[2,4097],[32,4096],[.5,3],[NaN,3]])
    assert.equal(parseEmbeddingOutput(embedding(),count,dimensions),null);
  for(const vectors of [[[1,2,3]],[[1,2],[1,2,3]],[[NaN,0,0],[1,2,3]],[[Infinity,0,0],[1,2,3]],
    [['1',2,3],[1,2,3]],new Array(2),[new Array(3),[1,2,3]]])
    assert.equal(parseEmbeddingOutput({vectors,usage:usage()},2,3),null);
  assert.equal(parseEmbeddingOutput({...embedding(),thinking:'private'},2,3),null);
  const boundary={vectors:Array.from({length:16},()=>Array(4096).fill(0)),usage:usage()};
  assert.ok(parseEmbeddingOutput(boundary,16,4096));
});

test('reranking rejects foreign/duplicate IDs, partial output, bad order and invalid candidate sets',()=>{
  for(const items of [[{id:'other',score:3},{id:'b',score:2}],
    [{id:'a',score:3},{id:'a',score:2}],[{id:'a',score:3}],
    [{id:'a',score:1},{id:'b',score:2}],[{id:'a',score:NaN},{id:'b',score:0}],
    [{id:'a',score:1,private:'hidden'},{id:'b',score:0}],new Array(2)])
    assert.equal(parseRerankOutput({items,usage:usage()},['a','b'],2),null);
  for(const ids of [[],['a','a'],['a','private/id'],new Array(2),Array(101).fill('a')])
    assert.equal(parseRerankOutput(ranking(),ids,2),null);
  for(const k of [0,-1,3,NaN,.5])assert.equal(parseRerankOutput(ranking(),['a','b'],k),null);
  assert.ok(parseRerankOutput({items:[{id:'a',score:0},{id:'b',score:0}],usage:usage()},['a','b'],2));
});

test('usage is nullable but never negative, fractional, stringified or private metadata',()=>{
  for(const invalid of [{inputTokens:-1,outputTokens:null},{inputTokens:1.5,outputTokens:0},
    {inputTokens:'1',outputTokens:0},{inputTokens:0,outputTokens:Infinity},{inputTokens:null},
    {inputTokens:0,outputTokens:0,secret:'private'}]){
    assert.equal(parseEmbeddingOutput({...embedding(),usage:invalid},2,3),null);
    assert.equal(parseRerankOutput({...ranking(),usage:invalid},['a','b'],2),null);
  }
  assert.ok(parseEmbeddingOutput({...embedding(),usage:{inputTokens:null,outputTokens:null}},2,3));
});

test('seeded malformed outputs cannot pass via arbitrary extra fields or invented IDs',()=>{
  let seed=20260928;const next=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  for(let i=0;i<512;i++){
    const e=embedding(),r=ranking(),n=next();
    if(n%2)e.vectors[n%2][n%3]=n%4===1?'bad':Infinity;else e['unexpected'+n]=n;
    if(n%2)r.items[n%2].id='unknown'+n;else r.items[n%2]['unexpected'+n]=n;
    assert.equal(parseEmbeddingOutput(e,2,3),null);assert.equal(parseRerankOutput(r,['a','b'],2),null);
  }
});
