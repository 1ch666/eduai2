// "完全隨機 AI 案件": the page sends only a request key. Case, procedure, role,
// ages and legal assistance are drawn by the server; the setup form is not read.
export const RANDOM_CASE_BUSY='正在隨機選擇合法程序並生成案件，請稍候……';
export function generationMessage(generation){
 if(generation?.mode==='ai')return '已建立 AI 虛構案件並保存場次。';
 const reasons={OUTPUT_TRUNCATED:'AI 輸出達長度上限，未採用不完整內容',TIMEOUT:'AI 生成逾時',QUOTA:'AI 供應商額度或頻率受限',COOLDOWN:'AI 失敗後冷卻中，約 5 分鐘後可再嘗試',BUDGET:'今日案件 AI 嘗試次數已達上限',DISABLED:'案件 AI 尚未啟用或設定',LIBRARY:'本次選用題庫',INVALID_DRAFT:'AI 案件未通過格式或安全檢查',SIMILAR:'AI 案件與既有內容過於相似'};
 const reason=Object.hasOwn(reasons,generation?.reason)?reasons[generation.reason]:'AI 暫不可用';
 return reason+'，已改用題庫隨機案件並保存場次。';
}
export function installRandomCase({button,api,open,status,run,ready,randomUUID=()=>crypto.randomUUID()}){
 // Kept across transport failures so a retry replays the same server receipt
 // instead of drawing (and possibly spending AI quota on) a second case.
 let requestId=null;
 button.addEventListener('click',()=>void run(async()=>{
  if(button.disabled||!ready())return;
  requestId??=randomUUID();button.disabled=true;status(RANDOM_CASE_BUSY);
  try{
   const p=await api('/api/court/cases/random',{requestId});requestId=null;open(p.view);
   status(generationMessage(p.generation));
  }catch(e){if(!(e instanceof TypeError))requestId=null;throw e;}
  finally{button.disabled=false;}
 }));
}
