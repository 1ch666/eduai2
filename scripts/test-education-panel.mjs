import test from 'node:test';
import assert from 'node:assert/strict';
import {createEducationPanel} from '../court/education-panel.js';
import {newEducationFlow,educationFlowView,transitionEducationFlow} from '../src/court-education-flow.ts';
class Element{
 constructor(tag){this.tag=tag;this.textContent='';this.children=[];this.events={};}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this[k]=v;}addEventListener(k,fn){this.events[k]=fn;}
 fire(k){this.events[k]?.({preventDefault(){}});}
}
const nodes=n=>[n,...n.children.flatMap(nodes)];
const text=n=>nodes(n).map(e=>e.textContent).join(' ');
function fixture(){const calls=[];const panel=createEducationPanel({document:{createElement:t=>new Element(t)},onAction:(...a)=>calls.push(a),onWithdraw:()=>calls.push('withdraw'),onRefresh:()=>calls.push('refresh')});return {panel,calls};}
test('consent requires active opt-in; duplicate clicks and obsolete forms cannot submit',()=>{
 const {panel,calls}=fixture();panel.render(educationFlowView(newEducationFlow()));
 const all=nodes(panel.element),form=all.find(n=>n.tag==='form'),check=all.find(n=>n.type==='checkbox');
 form.fire('submit');assert.equal(calls.length,0);check.checked=true;form.fire('submit');form.fire('submit');
 assert.deepEqual(calls,[[{kind:'consent'},0]]);
 assert.match(text(panel.element),/並非匿名/);assert.match(text(panel.element),/30 天/);
 panel.clear();form.fire('submit');assert.equal(calls.length,1);assert.equal(panel.element.hidden,true);
});
test('pre-test has no default answers, sends only selected values and never computes scores',()=>{
 const {panel,calls}=fixture(),s=transitionEducationFlow(newEducationFlow(),{kind:'consent'},0,'not_started');
 const view=educationFlowView(s);panel.render(view);
 const all=nodes(panel.element),form=all.find(n=>n.tag==='form');
 form.fire('submit');assert.equal(calls.length,0);
 for(const field of all.filter(n=>n.tag==='fieldset'))nodes(field).find(n=>n.type==='radio').checked=true;
 form.fire('submit');assert.equal(calls.length,1);assert.equal(calls[0][0].kind,'pre');assert.equal(calls[0][1],1);
 assert.deepEqual(calls[0][0].submission.answers,{'pre-evidence':0,'pre-time':0,'pre-procedure':0});
 assert(!text(panel.element).includes('前測 0 /'));assert(nodes(panel.element).every(n=>!Object.hasOwn(n,'innerHTML')));
});
test('disabled collection still offers withdrawal, busy and stale actions are fenced',()=>{
 const {panel,calls}=fixture(),s=transitionEducationFlow(newEducationFlow(),{kind:'consent'},0,'not_started');
 panel.render(educationFlowView(s),{enabled:false});
 const withdraw=nodes(panel.element).find(n=>n.textContent==='確認撤回測驗資料');assert.equal(withdraw.disabled,false);withdraw.fire('click');assert.deepEqual(calls,['withdraw']);
 panel.render(educationFlowView(s),{busy:true});nodes(panel.element).find(n=>n.textContent==='確認撤回測驗資料').fire('click');assert.equal(calls.length,1);
 panel.clear();withdraw.fire('click');assert.equal(calls.length,1);
 panel.render({phase:'disabled'});assert(!nodes(panel.element).some(n=>n.tag==='form'));assert.match(text(panel.element),/不影響法庭/);
});
test('post-test and survey follow server phases; final view shows only server scores',()=>{
 const {panel,calls}=fixture();let state=newEducationFlow();
 const apply=(action,progress)=>{state=transitionEducationFlow(state,action,state.revision,progress);assert.ok(state);panel.render(educationFlowView(state));};
 apply({kind:'consent'},'not_started');
 apply({kind:'pre',submission:{version:state.version,phase:'pre',answers:{'pre-evidence':0,'pre-time':0,'pre-procedure':0}}},'not_started');
 nodes(panel.element).find(n=>n.textContent==='確認案件完成，進入後測').fire('click');
 assert.deepEqual(calls.pop(),[{kind:'case_completed'},2]);assert.equal(state.phase,'playing');
 apply({kind:'case_completed'},'completed');
 const chooseFirst=()=>{for(const field of nodes(panel.element).filter(n=>n.tag==='fieldset'))nodes(field).find(n=>n.type==='radio').checked=true;nodes(panel.element).find(n=>n.tag==='form').fire('submit');};
 chooseFirst();let [action,revision]=calls.pop();assert.equal(revision,3);assert.equal(action.kind,'post');apply(action,'completed');
 assert.match(text(panel.element),/前測 1 \/ 3；後測 1 \/ 3/);
 chooseFirst();[action,revision]=calls.pop();assert.equal(revision,4);assert.deepEqual(action.submission.ratings,{clarity:1,evidence:1,followup:1,usability:1});apply(action,'completed');
 assert.equal(state.phase,'complete');assert(!nodes(panel.element).some(n=>n.tag==='form'));assert.match(text(panel.element),/不代表已證實/);
 panel.render({phase:'withdrawn'});assert(!nodes(panel.element).some(n=>n.textContent==='確認撤回測驗資料'));
});
