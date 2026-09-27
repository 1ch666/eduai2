import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

// Execute the actual page controller, with an intentionally small DOM double.
// This verifies state/request behavior, not browser layout or accessibility.
async function fixture() {
  const nodes=new Map(), requests=[];
  function element() {
    return {children:[],hidden:false,disabled:false,textContent:'',value:'',attrs:{},
      setAttribute(k,v){this.attrs[k]=v;},
      replaceChildren(...children){this.children=children;},
      addEventListener(k,fn){this[k]=fn;},append(...items){this.children.push(...items);},focus(){this.focused=true;}};
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const question={subject:'law',concept:'教學概念',difficulty:1,text:'測試題',answers:['甲','乙','丙']};
  let fail=false;
  const context=vm.createContext({
    document:{getElementById:get,createElement:element},
    location:{hostname:'localhost'},URLSearchParams,
    window:{EduAuth:{session:async()=>({user:{displayName:'測試'},csrfToken:'test'})}},
    fetch:async(path,options)=>{
      requests.push({path,options});
      if(path.includes('/answer')){
        if(fail)throw Error('連線中斷');
        return {ok:true,status:200,json:async()=>({correct:false,correctIndex:1,explanation:'解析',source:'來源',firstAttempt:true})};
      }
      if(path.includes('/weakness'))return {ok:true,status:200,json:async()=>({weakness:[]})};
      return {ok:true,status:200,json:async()=>({questionToken:'test-token',question})};
    }
  });
  const source=(await readFile(new URL('../practice/practice.js',import.meta.url),'utf8')).replace("import '../auth-sync.js';",'');
  await vm.runInContext(`(async()=>{${source}\n})()`,context);
  await get('get-question').onclick();
  return {get,requests,setFailure(){fail=true;}};
}
test('selection can change; only confirmation submits; correct and chosen answers stay visible',async()=>{
  const {get,requests}=await fixture();
  assert.equal(get('confirm-answer').disabled,true);
  get('choices').children[2].click();
  get('choices').children[0].click();
  assert.equal(requests.filter(r=>r.path.includes('/answer')).length,0);
  assert.equal(get('choices').children[2].attrs['aria-pressed'],'false');
  assert.equal(get('confirm-answer').disabled,false);
  await Promise.all([get('confirm-answer').onclick(),get('confirm-answer').onclick()]);
  const writes=requests.filter(r=>r.path.includes('/answer'));
  assert.equal(writes.length,1);
  assert.equal(JSON.parse(writes[0].options.body).answer,0);
  assert.equal(get('question-section').hidden,false);
  assert.equal(get('choices').children[0].className,'answer-wrong');
  assert.equal(get('choices').children[1].className,'answer-correct');
  assert.match(get('choices').children[0].textContent,/你的選擇/);
  assert.match(get('choices').children[1].textContent,/正確答案/);
  await get('show-weakness').onclick();
  get('close-weakness').onclick();
  assert.equal(get('result-section').hidden,false);
  await get('next-question').onclick();
  assert.equal(get('confirm-answer').disabled,true);
  assert.equal(get('result-section').hidden,true);
});
test('unknown mutation outcome is not retried or falsely scored',async()=>{
  const {get,requests,setFailure}=await fixture();
  setFailure();
  get('choices').children[0].click();
  await get('confirm-answer').onclick();
  await get('confirm-answer').onclick();
  assert.equal(requests.filter(r=>r.path.includes('/answer')).length,1);
  assert.equal(get('result-section').hidden,true);
  assert.match(get('answer-help').textContent,/可能已記錄/);
  await get('show-weakness').onclick();get('close-weakness').onclick();
  assert.equal(get('result-section').hidden,true);
  await get('get-question').onclick();
  assert.equal(get('choices').children[0].attrs['aria-pressed'],'false');
});
