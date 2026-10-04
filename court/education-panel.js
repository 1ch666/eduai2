// Presentation only. The host supplies an authenticated, validated server view
// and handles recovery. This component never fetches, scores or stores answers.
export function createEducationPanel({document,onAction,onWithdraw,onRefresh}){
 const root=document.createElement('section');root.setAttribute('aria-label','學習前後測');root.hidden=true;
 let generation=0;
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function render(view,{busy=false,message='',enabled=true,pending=false}={}){
  const ticket=++generation;root.replaceChildren();root.hidden=!view;if(!view)return;
  root.setAttribute('aria-busy',String(busy));
  const status=make('p',message);status.setAttribute('role','status');
  root.append(make('h2','學習前後測'),status);
  let dispatched=false;
  const dispatch=fn=>{if(ticket!==generation||busy||dispatched)return;dispatched=true;fn();};
  const button=(label,fn)=>{const b=make('button',label);b.type='button';b.disabled=busy;b.addEventListener('click',()=>dispatch(fn));return b;};
  root.append(button('更新測驗狀態',onRefresh));
  if(view.phase==='disabled'){root.append(make('p','學習前後測尚未開放，不影響法庭遊戲。'));return;}
  if(view.phase==='withdrawn'){root.append(make('p','本場測驗資料已撤回或到期清除，不可重新加入。法庭結果不受影響。'));return;}
  root.append(make('p',view.limitation));
  if(pending)root.append(make('p','上一筆結果尚未確認；請先更新狀態或重送同一筆，暫不接受新作答。'));
  else if(!enabled)root.append(make('p','目前停止收集新作答；你仍可查看或撤回既有資料。'));
  enabled=enabled&&!pending;
  const actionButton=(label,action)=>{const b=button(label,()=>onAction(action,view.revision));b.disabled=busy||!enabled;return b;};
  if(view.phase==='off'){
   root.append(make('p','自願參加，可不參加並繼續遊戲。記錄前後測分數與四項問卷評分，保存在此帳號的場次中，並非匿名研究資料；不保留逐題答案，但會保存請求摘要以避免重複提交。'));
   root.append(make('p','同意後最多保存 30 天，可隨時撤回；刪除場次也會清除測驗內容。分數不列入排行榜，不能單獨用來證明教育成效。'));
   const form=make('form'),label=make('label'),check=make('input');check.type='checkbox';check.required=true;check.disabled=busy||!enabled;
   label.append(check,make('span','我已閱讀上述說明，自願參加本場前後測。'));
   const submit=make('button','同意並開始前測');submit.type='submit';submit.disabled=busy||!enabled;form.append(label,submit);
   form.addEventListener('submit',e=>{e.preventDefault();if(check.checked&&enabled)dispatch(()=>onAction({kind:'consent'},view.revision));});root.append(form);return;
  }
  if(view.phase==='pre'||view.phase==='post'||view.phase==='survey'){
   const survey=view.phase==='survey',questions=survey?view.survey:view.questions,form=make('form'),selections=[];
   root.append(make('h3',survey?'操作回饋問卷':view.phase==='pre'?'前測':'後測'));
   for(const q of questions){
    const field=make('fieldset');field.append(make('legend',q.text));const inputs=[];
    const choices=survey?view.scale.labels:q.choices;
    choices.forEach((text,i)=>{const label=make('label'),input=make('input');input.type='radio';input.name=q.id;input.value=String(survey?i+1:i);input.required=true;input.disabled=busy||!enabled;label.append(input,make('span',text));field.append(label);inputs.push(input);});
    selections.push({id:q.id,inputs});form.append(field);
   }
   const submit=make('button',survey?'送出問卷':'確認並送出答案');submit.type='submit';submit.disabled=busy||!enabled;form.append(submit);
   form.addEventListener('submit',e=>{
    e.preventDefault();if(!enabled||selections.some(q=>!q.inputs.some(i=>i.checked)))return;
    const answers=Object.fromEntries(selections.map(q=>[q.id,Number(q.inputs.find(i=>i.checked).value)]));
    const submission=survey?{version:view.version,ratings:answers}:{version:view.version,phase:view.phase,answers};
    dispatch(()=>onAction({kind:view.phase,submission},view.revision));
   });root.append(form);
  }
  if(view.phase==='playing'){
   root.append(make('p','前測已保存。請完成法庭案件，再進行後測。'));
   root.append(actionButton('確認案件完成，進入後測',{kind:'case_completed'}));
  }
  if(view.phase==='complete')root.append(make('p','本場前後測與問卷已完成。'));
  if(view.results)root.append(make('p',`前測 ${view.results.pre.score} / ${view.results.pre.total}；後測 ${view.results.post.score} / ${view.results.post.total}。這只是本次試題的作答結果，不代表已證實學習成效。`));
  const withdrawal=make('details');withdrawal.append(make('summary','撤回本場測驗資料'));
  withdrawal.append(make('p','會永久清除本場測驗分數、問卷及提交紀錄，不能重新加入本場測驗；不刪除法庭遊戲進度。'));
  withdrawal.append(button('確認撤回測驗資料',onWithdraw));root.append(withdrawal);
 }
 return {element:root,render,clear:()=>render(null)};
}
