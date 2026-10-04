import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,rolesFor,PROCEDURAL_REQUESTS,newCourtAt,reduceCourt,newCourt,transition} from '../src/court-rules.ts';

const time='2026-09-28T01:02:03.456Z';
const config=(t,role='judge')=>({caseId:t.id,role,claimantAge:20,claimantHearingAge:20,
 respondentAge:t.procedure==='juvenile'?15:20,respondentHearingAge:t.procedure==='juvenile'?15:20,
 claimantAid:role==='claimantCounsel'?'private':'none',
 respondentAid:['respondentCounsel','assistant'].includes(role)?'private':t.mandatory?'appointed':'none'});

test('every template and role reproduces complete state without wall clock or randomness',()=>{
 const NativeDate=globalThis.Date,random=Math.random;
 globalThis.Date=class extends NativeDate{
  constructor(...args){if(!args.length)throw Error('wall clock read');super(...args);}
  static now(){throw Error('wall clock read');}
 };
 Math.random=()=>{throw Error('random read');};
 try{
  for(const t of CASES)for(const role of rolesFor(t.procedure)){
   const c=config(t,role),initial=newCourtAt('session','owner',c,time),before=structuredClone(initial);
   let left=initial,right=structuredClone(initial),count=0;
   const act=(type,extra={})=>{
    const action={requestId:'action-'+(++count),version:left.version,type,...extra};
    const old=left,previous=structuredClone(left),input=structuredClone(action);
    left=reduceCourt(left,action,time);right=reduceCourt(right,action,time);
    assert.deepEqual(left,right);assert.deepEqual(action,input);
    assert.deepEqual(old,previous);
    assert.equal(previous.version,left.version-1);assert.equal(left.updatedAt,time);
   };
   if(role==='observer'){for(let i=0;i<5;i++)act('step');}
   else{
    act('acknowledge');act('speak',{text:'確認案件爭點'});
    if(left.investigation){act('investigate.question.Witness');act('investigate.discover');act('investigate.present.Witness');act('investigate.followUp.Witness');}
    else for(const e of t.evidence)act('review',{evidenceId:e.id});
    if(role==='judge')for(const r of PROCEDURAL_REQUESTS)act('rule',{rulingId:r.id,decision:r.correct});
    act('closeEvidence');act('speak',{text:'區分事實推論'});
    act('answer',{answer:(t.correct+1)%t.answers.length});act('answer',{answer:t.correct});
   }
   assert.equal(left.completed,true);assert.deepEqual(initial,before);
  }
 }finally{globalThis.Date=NativeDate;Math.random=random;}
});

test('canonical timestamps fail closed and rejected reductions leave input untouched',()=>{
 const c=config(CASES[0]),s=newCourtAt('s','o',c,time),before=structuredClone(s);
 for(const value of [undefined,null,0,'','2026-02-30T00:00:00.000Z','2026-09-28',
  '2026-09-28T01:02:03Z','2026-09-28T09:02:03.456+08:00']){
  assert.throws(()=>newCourtAt('s','o',c,value),/時間格式/);
  assert.throws(()=>reduceCourt(s,{requestId:'a',version:0,type:'acknowledge'},value),/時間格式/);
 }
 assert.throws(()=>reduceCourt(s,{requestId:'a',version:1,type:'acknowledge'},time),/版本/);
 assert.throws(()=>reduceCourt(s,{requestId:'a',version:0,type:'answer',answer:1},time),/階段/);
 assert.deepEqual(s,before);
 c.role='observer';assert.equal(s.config.role,'judge','initializer must detach config');
});

test('clock adapters preserve legacy semantics and capture creation time once',()=>{
 const NativeDate=globalThis.Date;let reads=0;
 globalThis.Date=class extends NativeDate{
  constructor(...args){if(args.length)super(...args);else{reads++;super(time);}}
 };
 try{
  const c=config(CASES[0]),s=newCourt('s','o',c);assert.equal(reads,1);
  assert.deepEqual(s,newCourtAt('s','o',c,time));
  const action={requestId:'a',version:0,type:'acknowledge'};
  assert.deepEqual(transition(s,action),reduceCourt(s,action,time));assert.equal(reads,2);
 }finally{globalThis.Date=NativeDate;}
});
