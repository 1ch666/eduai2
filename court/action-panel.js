import {CourtTransport} from './transport.js';
import {createEvidenceViewer} from './evidence-viewer.js';

// One authenticated transport owns this panel's state and uncertain mutations.
// The panel never calculates stages, scores or legal eligibility.
export function installActionPanel({document,window,getView,getAccount,csrf,beforeOpen,onUpdated}){
 const transport=new CourtTransport({origin:window.location.origin,csrf});
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const dialog=make('dialog');dialog.className='game-panel';dialog.setAttribute('aria-label','伺服器程序操作');
 const close=make('button','關閉');close.type='button';close.onclick=()=>dialog.close();
 const heading=make('h2','程序操作'),notice=make('p');notice.setAttribute('role','status');
 const body=make('div'),recovery=make('div');recovery.className='bar';
 const textLabel=make('label','陳述內容'),text=make('textarea');text.maxLength=600;text.rows=4;textLabel.append(text);
 const targetLabel=make('label','選擇證物'),target=make('select');targetLabel.append(target);
 const actions=make('div');actions.className='server-actions';
 const refresh=make('button','更新狀態'),recover=make('button','查詢上次送出結果'),retry=make('button','重送同一筆操作');
 for(const b of [refresh,recover,retry])b.type='button';
 recovery.append(refresh,recover,retry);body.append(textLabel,targetLabel,actions);
 const evidenceViewer=createEvidenceViewer({document});
 dialog.append(close,heading,notice,evidenceViewer.element,body,recovery);document.body.append(dialog);
 let context=null,generation=0,working=false,returnFocus=null;
 const valid=()=>context&&getView()?.id===context.session&&getAccount()?.id===context.owner;
 const messages={accepted:'已同步伺服器紀錄。',duplicate:'這筆操作已保存，未重複執行。',stale:'已保留較新的狀態。',conflict:'狀態已改變，請更新後重新確認。','login-required':'登入已失效，請重新登入。',forbidden:'沒有執行權限，請更新登入狀態。','rate-limited':'操作頻繁，請稍候再試。',timeout:'等待逾時；操作可能已保存，請先查詢結果。',network:'連線中斷；操作結果尚未確認。','outcome-unknown':'尚未取得結果，可稍後查詢；不要建立另一筆相同操作。','retry-exhausted':'已達重送上限，請繼續查詢結果。',malformed:'回覆格式不符，未套用資料。','not-allowed':'目前不能執行這個動作。','needs-snapshot':'請先更新伺服器狀態。'};
 function render(){
  const snapshot=transport.snapshot,pending=transport.pending;
  evidenceViewer.setSnapshot(snapshot);
  heading.textContent=snapshot?`${snapshot.state.stageLabel} · 版本 ${snapshot.stateVersion}`:'程序操作';
  refresh.disabled=working;recover.disabled=working||!pending;retry.disabled=working||!pending||pending.attempts>=3;
  recover.hidden=retry.hidden=!pending;actions.replaceChildren();
  text.disabled=target.disabled=working||!!pending;
  textLabel.hidden=!snapshot?.state.allowedActions.some(a=>a.category==='statement');
  targetLabel.hidden=!snapshot?.state.allowedActions.some(a=>a.requiredTarget==='evidence');
  const selected=target.value;target.replaceChildren();
  for(const e of snapshot?.state.evidence||[]){const o=make('option',e.title);o.value=e.evidenceId;target.append(o);}
  if([...target.options].some(o=>o.value===selected))target.value=selected;
  for(const action of snapshot?.state.allowedActions||[]){
   const row=make('section'),button=make('button',action.label);button.type='button';
   const unsupported=!['none','evidence'].includes(action.requiredTarget);
   button.disabled=working||!transport.canAct||!action.enabled||unsupported;
   button.onclick=()=>void execute(()=>transport.act(action.actionId,{targetId:action.requiredTarget==='evidence'?target.value:'',text:action.category==='statement'?text.value:''}),true);
   row.append(button);
   if(!action.enabled||unsupported)row.append(make('p',unsupported?'此操作的目標類型尚未支援。':action.reasonDisabled||'目前不可使用。'));
   actions.append(row);
  }
  if(snapshot?.state.completed)actions.append(make('p',snapshot.state.feedback||'此場次已完成。'));
 }
 async function execute(operation,mutation=false){
  if(working||!valid())return;
  const started=generation;working=true;notice.textContent='正在與伺服器同步…';render();
  try{
   const result=await operation();if(started!==generation)return;if(!valid()){clear();return;}
   notice.textContent=messages[result]||'操作尚未完成，請更新狀態或查詢結果。';
   if(['accepted','duplicate','stale'].includes(result)){
    if(mutation&&!transport.pending)text.value='';
    await onUpdated(transport.snapshot);
   }
  }catch{if(started===generation)notice.textContent='無法完成同步，請查詢結果或更新狀態。';}
  finally{if(started===generation){working=false;render();}}
 }
 refresh.onclick=()=>void execute(()=>transport.refresh());
 recover.onclick=()=>void execute(()=>transport.recoverPending(),true);
 retry.onclick=()=>void execute(()=>transport.retry(),true);
 function clear(){generation++;context=null;working=false;transport.clear();text.value='';notice.textContent='';render();if(dialog.open)dialog.close();}
 dialog.addEventListener('close',()=>{if(!dialog.open&&returnFocus?.isConnected)returnFocus.focus();});
 window.addEventListener('pagehide',clear);
 document.getElementById('logout')?.addEventListener('click',clear,{capture:true});
 return {clear,get pending(){return !!transport.pending;},get working(){return working;},open(){
  const v=getView(),a=getAccount();if(!v||!a)return;
  returnFocus=document.activeElement;beforeOpen();
  if(!context||context.session!==v.id||context.owner!==a.id){clear();context={session:v.id,owner:a.id};transport.bind(v.id,v.config.caseId);}
  if(!dialog.open)dialog.showModal();render();
  // Preserve an uncertain request when reopening; never silently replace IDs.
  if(transport.pending)notice.textContent='上次操作結果尚未確認，請先查詢結果。';
  else void execute(()=>transport.refresh());
 }};
}
