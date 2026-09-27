import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {CASES,rolesFor} from '../src/court-rules.ts';
const bundle=await build({entryPoints:['src/court-reachability.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {checkCaseReachability:check}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('every template and evidence/answer variation has a legal completion path for every role',()=>{
 for(const base of CASES)for(const count of [1,2,4,16])for(let correct=0;correct<4;correct++){
  const candidate={...structuredClone(base),correct,evidence:Array.from({length:count},(_,i)=>({...base.evidence[0],id:'e-'+i}))};
  const before=structuredClone(candidate),expected={ok:true,checkedRoles:rolesFor(base.procedure).length};
  assert.deepEqual(check(candidate,base.id),expected);assert.deepEqual(check(candidate,base.id),expected);
  assert.deepEqual(candidate,before);
 }
});

test('rejects duplicate evidence, invalid answer keys and legal policy changes',()=>{
 const base=CASES[0];
 for(const correct of [-1,4,NaN,Infinity,1.5])assert.deepEqual(check({...base,correct},base.id),{ok:false,code:'ANSWER_KEY'});
 for(const answers of [[],['one'],Array(4),['one',null]])assert.equal(check({...base,answers},base.id).code,'ANSWER_KEY');
 for(const evidence of [[],[base.evidence[0],base.evidence[0]],[{...base.evidence[0],id:''}],Array(2)])
  assert.equal(check({...base,evidence},base.id).code,'EVIDENCE_IDS');
 for(const delta of [{procedure:'juvenile'},{mandatory:!base.mandatory},{aidApproved:!base.aidApproved}])
  assert.equal(check({...base,...delta},base.id).code,'TEMPLATE_POLICY');
 assert.equal(check(base,'unknown').code,'TEMPLATE_POLICY');
});
