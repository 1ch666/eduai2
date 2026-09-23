import test from 'node:test';
import assert from 'node:assert/strict';
import { AGE_LIMITS, CASES, rolesFor, validateConfig, newCourt, transition, courtView } from '../src/court-rules.ts';
const config=t=>({caseId:t.id,role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:t.procedure==='juvenile'?15:20,respondentHearingAge:t.procedure==='juvenile'?15:20,claimantAid:'none',respondentAid:t.mandatory?'appointed':'none'});
test('Every supported role completes each of six cases without skipping evidence',()=>{
 for(const t of CASES)for(const role of rolesFor(t.procedure)){
  const c={...config(t),role};if(role==='claimantCounsel')c.claimantAid='private';if(['respondentCounsel','assistant'].includes(role))c.respondentAid='private';
  let s=newCourt('case','owner',c);const act=(type,extra={})=>s=transition(s,{requestId:crypto.randomUUID(),version:s.version,type,...extra});
  if(role==='observer'){for(let i=0;i<5;i++)act('step');}else{
   act('acknowledge');act('speak',{text:'請確認案件爭點'});
   assert.throws(()=>act('closeEvidence'));for(const e of t.evidence)act('review',{evidenceId:e.id});
   if(role==='judge'){
    assert.throws(()=>act('closeEvidence'));
    act('rule',{rulingId:'shortcut',decision:'allow'});assert.throws(()=>act('closeEvidence'));
    act('rule',{rulingId:'shortcut',decision:'deny'});act('rule',{rulingId:'heard',decision:'allow'});
   }else assert.throws(()=>act('rule',{rulingId:'heard',decision:'allow'}));
   act('closeEvidence');act('speak',{text:'請區分證據與推論'});
   act('answer',{answer:(t.correct+1)%4});assert.equal(s.completed,false);act('answer',{answer:t.correct});
  }
  assert.equal(s.completed,true);assert.equal(courtView(s).assessment.ranked,false);assert(!('owner' in courtView(s)));
 }
});
test('Age and counsel constraints are hard rules, not model suggestions',()=>{
 const adult=config(CASES[2]);assert.match(validateConfig({...adult,respondentAge:17}),/成人/);
 const youth=config(CASES[4]);for(const age of [11,18])assert(validateConfig({...youth,respondentAge:age,respondentHearingAge:age}));
 for(const age of [12,17])assert.equal(validateConfig({...youth,respondentAge:age,respondentHearingAge:age}),null);
 assert(validateConfig({...youth,role:'observer'}));assert(validateConfig({...youth,respondentHearingAge:18}));
 assert(validateConfig({...config(CASES[3]),respondentAid:'none'}));assert(validateConfig({...adult,respondentAid:'appointed'}));
 assert(validateConfig({...adult,claimantAid:'legalAid'}));assert(validateConfig({...adult,claimantAge:NaN}));
 assert(validateConfig({...adult,respondentAge:30,respondentHearingAge:20}));
});
test('Both sides can be represented, and the published limits match the checks',()=>{
 const criminal=CASES.find(t=>t.procedure==='criminal'),juvenile=CASES.find(t=>t.procedure==='juvenile');
 for(const side of ['claimantCounsel','respondentCounsel'])assert(rolesFor('criminal').includes(side),side+' must be selectable in criminal templates');
 assert(!rolesFor('juvenile').includes('observer'));assert(!rolesFor('juvenile').includes('claimantCounsel'));
 const agent={...config(criminal),role:'claimantCounsel'};
 assert.equal(validateConfig({...agent,claimantAid:'private'}),null);
 assert(validateConfig(agent));assert(validateConfig({...agent,claimantAid:'appointed'}));
 assert.equal(courtView(newCourt('case','owner',{...agent,claimantAid:'private'})).notices.some(n=>n.includes('告訴人得委任代理人')),true);
 for(const t of CASES){const limits=AGE_LIMITS[t.procedure],c=config(t);
  assert.equal(validateConfig({...c,respondentAge:limits.actMin,respondentHearingAge:limits.actMin}),null);
  assert(validateConfig({...c,respondentAge:limits.actMin-1,respondentHearingAge:limits.actMin-1}),`${t.id} must reject below ${limits.actMin}`);
  if(t.procedure==='juvenile')assert(validateConfig({...c,respondentAge:limits.actMax+1,respondentHearingAge:limits.actMax+1}));}
 assert(AGE_LIMITS[juvenile.procedure].note.includes('不開放旁觀'));
});
test('Reject stale versions, fabricated evidence and out-of-stage actions',()=>{
 const s=newCourt('case','owner',config(CASES[0]));
 for(const a of [{type:'answer',answer:1,version:0},{type:'acknowledge',version:9},{type:'win',version:0}])assert.throws(()=>transition(s,{requestId:'test',...a}));
});
