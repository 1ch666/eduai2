import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize,normalizeQuery,buildBm25,searchBm25,reciprocalRankFusion } from '../src/legal-retrieval.ts';
import { validateGroundedAnswer,groundedFallback,mentionedArticles,chineseNumber } from '../src/citation-grounding.ts';
import { articleNo } from './legal-corpus.mjs';

const chunks=[
 {chunkId:'B0000001:12',lawName:'民法',article:'第 12 條',text:'滿十八歲為成年。'},
 {chunkId:'C0000001:320',lawName:'中華民國刑法',article:'第 320 條',text:'意圖為自己或第三人不法之所有，而竊取他人之動產者，為竊盜罪。'},
 {chunkId:'C0010001:236-1',lawName:'刑事訴訟法',article:'第 236-1 條',text:'告訴，得委任代理人行之。'},
];
const ctx={retrieved:chunks,allowedFactIds:['k0','k1']};

test('tokenizer normalizes width/space and emits CJK bigrams',()=>{
 assert.equal(normalizeQuery('ＡＢ　１２'),'ab12');
 assert.deepEqual(tokenize('竊盜罪 236-1'),['竊盜','盜罪','236-1']);
 assert.deepEqual(tokenize('罪'),['罪']);
});
test('BM25 ranks the matching article first and is deterministic',()=>{
 const index=buildBm25(chunks);
 assert.equal(searchBm25(index,'竊取他人動產',3)[0].chunkId,'C0000001:320');
 assert.equal(searchBm25(index,'幾歲成年',3)[0].chunkId,'B0000001:12');
 assert.deepEqual(searchBm25(index,'代理人',3),searchBm25(buildBm25(chunks),'代理人',3));
 assert.deepEqual(searchBm25(index,'完全無關的外星文字xyz',3),[]);
});
test('RRF rewards agreement across rankers',()=>{
 const fused=reciprocalRankFusion([[{chunkId:'a',score:9},{chunkId:'b',score:1}],[{chunkId:'b',score:9},{chunkId:'c',score:1}]],3);
 assert.equal(fused[0].chunkId,'b');
});
test('article labels and Chinese numerals parse to one canonical form',()=>{
 assert.equal(articleNo('第 236-1 條'),'236-1');assert.equal(articleNo('第 5 章'),null);
 assert.equal(chineseNumber('二百三十六'),236);assert.equal(chineseNumber('十'),10);assert.equal(chineseNumber('十八'),18);
 assert.deepEqual(mentionedArticles('依第二百三十六條之一及第 12 條、第236-1條'),['236-1','12','236-1']);
});
test('grounded answer accepts only retrieved citations and projected facts',()=>{
 const ok=validateGroundedAnswer({answer:'依民法第12條，滿十八歲為成年。',citationIds:['B0000001:12'],factIds:[],uncertainty:'low'},ctx);
 assert.equal(ok.ok,true);assert.equal(ok.value.fallbackUsed,false);
 assert.equal(validateGroundedAnswer({answer:'不確定',citationIds:[],factIds:[],uncertainty:'high'},ctx).ok,true);
 const bad=(v,code)=>assert.deepEqual(validateGroundedAnswer({answer:'答案',citationIds:['B0000001:12'],factIds:[],uncertainty:'low',...v},ctx),{ok:false,code});
 bad({citationIds:['B0000001:13']},'UNKNOWN_CITATION');
 bad({factIds:['k9']},'UNKNOWN_FACT');
 bad({citationIds:[],factIds:[]},'UNGROUNDED');
 bad({answer:'依第184條應賠償。'},'UNSUPPORTED_ARTICLE');
 bad({answer:'<b>x</b>'},'MARKUP');
 bad({fallbackUsed:false},'SCHEMA');
 bad({uncertainty:'none'},'SCHEMA');
 bad({citationIds:['B0000001:12','B0000001:12']},'SCHEMA');
 assert.equal(validateGroundedAnswer(null,ctx).ok,false);
 assert.equal(groundedFallback().fallbackUsed,true);
});
