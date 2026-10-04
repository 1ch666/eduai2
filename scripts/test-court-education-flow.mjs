import test from 'node:test';
import assert from 'node:assert/strict';
import {newEducationFlow,transitionEducationFlow as move,educationFlowView as view} from '../src/court-education-flow.ts';
const version=newEducationFlow().version;
const pre={version,phase:'pre',answers:{'pre-evidence':1,'pre-time':2,'pre-procedure':0}};
const post={version,phase:'post',answers:{'post-evidence':2,'post-time':0,'post-procedure':1}};
const survey={version,ratings:{clarity:4,evidence:3,followup:5,usability:4}};
function advance(s,a,p){const n=move(s,a,s.revision,p);assert(n);return n;}
test('consented full assessment flow exposes only eligible forms and delayed scores',()=>{
 let s=newEducationFlow();assert.equal(view(s).questions.length,0);
 s=advance(s,{kind:'consent'},'not_started');assert(view(s).questions.every(q=>q.id.startsWith('pre-')));
 s=advance(s,{kind:'pre',submission:pre},'not_started');assert.equal(view(s).results,null);assert.equal(view(s).questions.length,0);
 assert.equal(move(s,{kind:'case_completed'},s.revision,'active'),null);
 s=advance(s,{kind:'case_completed'},'completed');assert(view(s).questions.every(q=>q.id.startsWith('post-')));assert.equal(view(s).results,null);
 s=advance(s,{kind:'post',submission:post},'completed');assert.deepEqual(view(s).results,{pre:{score:3,total:3},post:{score:3,total:3}});
 assert.equal(view(s).survey.length,4);
 s=advance(s,{kind:'survey',submission:survey},'completed');assert.equal(s.phase,'complete');assert.equal(s.revision,5);
 assert.equal(view(s).survey.length,0);assert(!JSON.stringify(view(s)).includes('ratings'));
 const copy=view(s);copy.results.pre.score=0;assert.equal(s.pre.score,3);
});
test('rejects skipping, late enrollment, stale writes, repeat scoring and client-selected phases',()=>{
 let s=newEducationFlow();const original=structuredClone(s);
 assert.equal(move(s,{kind:'consent'},0,'active'),null);
 assert.equal(move(s,{kind:'pre',submission:pre},0,'not_started'),null);assert.deepEqual(s,original);
 s=advance(s,{kind:'consent'},'not_started');
 assert.equal(move(s,{kind:'post',submission:post},1,'completed'),null);
 assert.equal(move(s,{kind:'pre',submission:pre},0,'not_started'),null);
 assert.equal(move(s,{kind:'pre',submission:pre},1,'active'),null);
 assert.equal(move(s,{kind:'pre',submission:post},1,'not_started'),null);
 s=advance(s,{kind:'pre',submission:pre},'not_started');
 assert.equal(move(s,{kind:'pre',submission:pre},2,'not_started'),null);
 assert.equal(move({...s,version:'bad'},{kind:'withdraw'},2,'active'),null);
});
test('withdrawal erases assessment values at every phase and prevents reenrollment',()=>{
 const states=[newEducationFlow()];
 for(const [a,p] of [[{kind:'consent'},'not_started'],[{kind:'pre',submission:pre},'not_started'],[{kind:'case_completed'},'completed'],[{kind:'post',submission:post},'completed'],[{kind:'survey',submission:survey},'completed']])states.push(advance(states.at(-1),a,p));
 for(const s of states){
  const w=advance(s,{kind:'withdraw'},'completed');assert.equal(w.phase,'withdrawn');assert.equal(w.pre,null);assert.equal(w.post,null);assert.equal(w.survey,null);
  assert.equal(view(w).results,null);assert.equal(view(w).questions.length,0);
  assert.equal(move(w,{kind:'consent'},w.revision,'not_started'),null);
  assert.equal(move(w,{kind:'withdraw'},w.revision,'completed'),null);
 }
});
