// Presentation only: opening the recovery panel never submits an action.
export function createRecoveryNotice({document,onOpen}){
 const element=document.createElement('section');element.className='recovery-notice';element.hidden=true;
 element.setAttribute('aria-label','操作恢復');
 const message=document.createElement('p');message.setAttribute('role','status');
 const button=document.createElement('button');button.type='button';button.textContent='開啟操作恢復';
 button.addEventListener('click',()=>{if(!element.hidden&&!button.disabled)onOpen();});
 element.append(message,button);
 return {element,update({pending=false,blocked=false,working=false}={}){
  element.hidden=!pending&&!blocked;
  const next=blocked?'分頁儲存功能無法使用，已停止新操作。請開啟操作恢復查看處理方式。'
   :pending?'上次操作結果尚未確認，請勿再次送出。若正在角色對話，請先關閉對話，再開啟操作恢復查詢結果。':'';
  // Avoid repeatedly announcing identical text on each render.
  if(message.textContent!==next)message.textContent=next;
  button.disabled=working;
 }};
}
