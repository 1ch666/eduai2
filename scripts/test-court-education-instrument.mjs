import test from 'node:test';
import assert from 'node:assert/strict';
import {EDUCATION_INSTRUMENT_VERSION as version,publicEducationInstrument,scoreEducationTest,parseEducationSurvey} from '../src/court-education-instrument.ts';
const pre={version,phase:'pre',answers:{'pre-evidence':1,'pre-time':2,'pre-procedure':0}};
test('public draft has parallel concepts, detached choices and no answer key',()=>{
 const p=publicEducationInstrument();assert.equal(p.validation,'draft-not-validated');
 assert.deepEqual(p.pre.map(q=>q.conceptId),p.post.map(q=>q.conceptId));
 assert(!JSON.stringify(p).includes('correct'));p.pre[0].choices[0]='changed';assert.notEqual(publicEducationInstrument().pre[0].choices[0],'changed');
});
test('server scorer validates exact version, host-selected phase and all bounded answers',()=>{
 assert.deepEqual(scoreEducationTest(pre,'pre'),{version,phase:'pre',score:3,total:3});
 assert.equal(scoreEducationTest({...pre,answers:{...pre.answers,'pre-evidence':0}},'pre').score,2);
 assert.equal(scoreEducationTest({version,phase:'post',answers:{'post-evidence':2,'post-time':0,'post-procedure':1}},'post').score,3);
 for(const bad of [{...pre,version:'unknown'},{...pre,phase:'post'},{...pre,secret:'x'},{...pre,answers:{}},{...pre,answers:{...pre.answers,'pre-time':'2'}},{...pre,answers:{...pre.answers,'pre-time':3}}])assert.equal(scoreEducationTest(bad,'pre'),null);
 assert.equal(scoreEducationTest(pre,'post'),null);
});
test('survey accepts only bounded fixed ratings, no identity/free text or executable fields',()=>{
 const input={version,ratings:{clarity:5,evidence:4,followup:3,usability:2}};
 assert.deepEqual(parseEducationSurvey(input),input);
 const result=parseEducationSurvey(input);result.ratings.clarity=1;assert.equal(input.ratings.clarity,5);
 for(const bad of [{...input,name:'person'},{...input,ratings:{...input.ratings,comment:'private'}},{...input,ratings:{...input.ratings,clarity:6}},{...input,ratings:{...input.ratings,clarity:0}}])assert.equal(parseEducationSurvey(bad),null);
 let called=false;const unsafe={version,get ratings(){called=true;throw Error();}};
 assert.equal(parseEducationSurvey(unsafe),null);assert.equal(called,false);
});
