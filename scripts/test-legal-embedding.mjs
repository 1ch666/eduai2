import test from 'node:test';
import assert from 'node:assert/strict';
import {legalVector,legalQueryText,legalDocumentText} from '../src/legal-embedding.ts';
test('Google MRL rejects foreign dimensions, invalid and zero vectors',()=>{
 for(const v of [null,Array(1024).fill(1),Array(256).fill(1),Array(768).fill(0),Array(768).fill(NaN)])assert.throws(()=>legalVector(v));
 const raw=Array(768).fill(1),v=legalVector(raw);assert.equal(raw.length,768);assert.equal(v.length,256);assert.equal(Math.hypot(...v),1);
});
test('query and document prompts remain separate and query input is bounded',()=>{
 assert.equal(legalQueryText('a'.repeat(500)),'task: search result | query: '+'a'.repeat(400));
 assert.equal(legalDocumentText({law:'民法',article:'第 12 條',part:1,text:'測試'}),'title: 民法 第 12 條（片段 1） | text: 測試');
});
