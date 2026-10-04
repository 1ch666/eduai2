import {CourtEducationClient} from './education-client.js';
import {createEducationPanel} from './education-panel.js';

export function createEducationHost({document,origin,getContext,csrf,fetchImpl=globalThis.fetch}){
 const client=new CourtEducationClient({origin,csrf,fetchImpl});
 const root=document.createElement('details'),summary=document.createElement('summary');summary.textContent='自願學習前後測';root.append(summary);root.hidden=true;
 const notice=document.createElement('p');notice.setAttribute('role','status');
 const refresh=document.createElement('button'),retry=document.createElement('button');
 refresh.type=retry.type='button';refresh.textContent='查看測驗狀態';retry.textContent='重送同一筆測驗';retry.hidden=true;
 let key='',epoch=0,working=false,disabled=false;
 const panel=createEducationPanel({document,onAction:(a,r)=>void execute(()=>client.submit(a,r)),onWithdraw:()=>void execute(()=>client.withdraw()),onRefresh:()=>void execute(()=>client.refresh())});
 root.append(notice,refresh,retry,panel.element);
 const messages={accepted:'已取得伺服器狀態。',disabled:'目前未開放前後測，仍可繼續遊戲。',conflict:'目前場次或測驗階段不允許這次操作，請更新測驗狀態。前測須在開庭前完成，後測須等案件完成。',forbidden:'請確認登入狀態後再試。','not-found':'此場次不存在或已無存取權限。','rate-limited':'操作較頻繁，請稍後再更新。','login-required':'請重新登入。',withdrawn:'資料已撤回或到期，請更新狀態。',timeout:'連線逾時，結果尚未確認。',unavailable:'暫時無法確認測驗結果，請更新狀態或重送同一筆。',pending:'上一筆送出結果尚未確認，請先更新或重送同一筆。','refresh-required':'請先取得最新測驗狀態。',stale:'收到較舊狀態，請稍後更新。'};
 function clear(){epoch++;key='';working=false;disabled=false;client.clear();panel.clear();notice.textContent='';root.hidden=true;root.open=false;retry.hidden=true;refresh.disabled=false;}
 function sync(){
  const c=getContext();const next=c?.owner&&c?.sessionId&&c.supported?`${c.owner}:${c.sessionId}`:'';
  if(next!==key){clear();if(next){key=next;client.bind(c.sessionId);root.hidden=false;notice.textContent='可選擇不參加，遊戲照常進行。先查看伺服器是否開放測驗。';}}
  return !!key;
 }
 function paint(){refresh.disabled=working;retry.hidden=!client.pending;retry.disabled=working;panel.render(client.view,{busy:working,enabled:!disabled,pending:client.pending});}
 async function execute(operation){
  if(!sync()||working)return;const ticket=epoch;working=true;paint();
  let result;try{result=await operation();}catch{result='unavailable';}
  sync();if(ticket!==epoch)return;
  working=false;if(result==='disabled')disabled=true;
  if(result==='login-required'||result==='not-found'){clear();return;}
  notice.textContent=messages[result]||'請更新測驗狀態。';paint();
 }
 refresh.addEventListener('click',()=>void execute(()=>client.refresh()));
 retry.addEventListener('click',()=>void execute(()=>client.retry()));
 return {element:root,sync,clear};
}
