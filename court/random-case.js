// "完全隨機 AI 案件": the page sends only a request key. Case, procedure, role,
// ages and legal assistance are drawn by the server; the setup form is not read.
export const RANDOM_CASE_BUSY='正在隨機選擇合法程序並生成案件，請稍候……';
export function installRandomCase({button,api,open,status,run,ready,randomUUID=()=>crypto.randomUUID()}){
 // Kept across transport failures so a retry replays the same server receipt
 // instead of drawing (and possibly spending AI quota on) a second case.
 let requestId=null;
 button.addEventListener('click',()=>void run(async()=>{
  if(button.disabled||!ready())return;
  requestId??=randomUUID();button.disabled=true;status(RANDOM_CASE_BUSY);
  try{
   const p=await api('/api/court/cases/random',{requestId});requestId=null;open(p.view);
   status(p.generation?.mode==='ai'?'已建立 AI 虛構案件並保存場次。':'AI 暫不可用，已改用題庫隨機案件並保存場次。');
  }catch(e){if(!(e instanceof TypeError))requestId=null;throw e;}
  finally{button.disabled=false;}
 }));
}
