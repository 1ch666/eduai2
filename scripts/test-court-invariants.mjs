import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,rolesFor,newCourtAt,reduceCourt,allowedActions,PROCEDURAL_REQUESTS} from '../src/court-rules.ts';
const timestamp='2026-09-28T00:00:00.000Z';
const newCourt=(id,owner,config)=>newCourtAt(id,owner,config,timestamp);
const transition=(state,action)=>reduceCourt(state,action,timestamp);
const config=(t,role)=>({caseId:t.id,role,claimantAge:20,claimantHearingAge:20,
  respondentAge:t.procedure==='juvenile'?15:20,respondentHearingAge:t.procedure==='juvenile'?15:20,
  claimantAid:role==='claimantCounsel'?'private':'none',respondentAid:['respondentCounsel','assistant'].includes(role)?'private':t.mandatory?'appointed':'none'});

test('seeded mixed action sequences preserve version, stage, evidence, roles and rejection atomicity',()=>{
  const stages=new Set([0]),acceptedTypes=new Set();let accepted=0,rejected=0;
  for(let seed=1;seed<=16;seed++)for(const template of CASES)for(const role of rolesFor(template.procedure)){
    let random=seed;const next=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return random>>>0;};
    let state=newCourt('fixture','owner',config(template,role));
    for(let step=0;step<80;step++){
      const n=next(),types=['acknowledge','speak','review','rule','closeEvidence','answer','step','invented'];
      const type=n%3===0?(allowedActions(state)[n%Math.max(1,allowedActions(state).length)]||'answer'):types[n%types.length];
      const action={requestId:`fixture-${seed}-${step}`,version:n%7===0?state.version-1:state.version,type,
        text:next()%5===0?'':'這是虛構的程序練習',evidenceId:next()%5===0?'missing':template.evidence[next()%template.evidence.length].id,
        answer:next()%6===0?-1:next()%template.answers.length,rulingId:next()%2?'heard':'shortcut',decision:next()%2?'allow':'deny'};
      const original=JSON.stringify(state),old=state;
      let result;
      try{result=transition(state,action);}catch{
        rejected++;
        assert.equal(JSON.stringify(state),original,'rejected action must not mutate input');continue;
      }
      assert.equal(JSON.stringify(old),original,'accepted transition must also leave input unchanged');
      accepted++;stages.add(result.stage);acceptedTypes.add(type);
      assert.ok(allowedActions(old).includes(type));assert.equal(action.version,old.version);
      assert.equal(result.version,old.version+1);assert.ok(Number.isSafeInteger(result.version));
      assert.ok(result.stage===old.stage||result.stage===old.stage+1);
      assert.equal(result.owner,old.owner);assert.deepEqual(result.config,old.config);
      assert.equal(new Set(result.reviewed).size,result.reviewed.length);
      assert.ok(result.reviewed.every(id=>template.evidence.some(e=>e.id===id)));
      assert.ok(old.reviewed.every(id=>result.reviewed.includes(id)));
      assert.equal(result.attempts,old.attempts+(type==='answer'?1:0));
      if(type==='rule')assert.equal(role,'judge');
      if(type==='closeEvidence'){
        assert.equal(result.reviewed.length,template.evidence.length);
        if(role==='judge')assert.ok(PROCEDURAL_REQUESTS.every(r=>result.rulings.includes(r.id)));
      }
      if(result.completed){assert.equal(result.stage,5);assert.deepEqual(allowedActions(result),[]);}
      // Exact repeatability, including timestamps; no metadata is discarded.
      assert.deepEqual(transition(old,action),result);
      assert.throws(()=>transition(result,action),'a stale reapplication must not count again');
      state=result;
    }
  }
  assert.ok(accepted>500);assert.ok(rejected>500);
  assert.deepEqual([...stages].sort(),[0,1,2,3,4,5]);
  assert.deepEqual([...acceptedTypes].sort(),['acknowledge','answer','closeEvidence','review','rule','speak','step'].sort());
});

test('transition refuses unsafe version and answer counters instead of overflowing',()=>{
  const state=newCourt('fixture','owner',config(CASES[0],'judge'));
  for(const version of [Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1,NaN,Infinity,-1,.5]){
    const s={...state,version};const before=structuredClone(s);
    assert.throws(()=>transition(s,{requestId:'fixture',version,type:'acknowledge'}));
    assert.deepEqual(s,before);
  }
  const lastSafe={...state,version:Number.MAX_SAFE_INTEGER-1};
  assert.equal(transition(lastSafe,{requestId:'fixture',version:lastSafe.version,type:'acknowledge'}).version,Number.MAX_SAFE_INTEGER);
  for(const attempts of [Number.MAX_SAFE_INTEGER,NaN,Infinity,-1,.5]){
    const s={...state,stage:4,attempts};
    assert.throws(()=>transition(s,{requestId:'fixture',version:0,type:'answer',answer:0}));
  }
});
