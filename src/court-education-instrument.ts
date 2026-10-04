// Draft original teaching instrument, NOT a validated research scale.
// Server-only answer keys. Collection requires a separately authorized,
// consented host; this module has no persistence, account mapping or telemetry.
export const EDUCATION_INSTRUMENT_VERSION='court-reasoning-draft-1';
type Question={id:string;conceptId:string;text:string;choices:readonly string[];correct:number};
const tests:Record<'pre'|'post',readonly Question[]>={
 pre:[
  {id:'pre-evidence',conceptId:'fact-inference',text:'紀錄只顯示某人進入房間，能直接確認什麼？',choices:['他拿走了物品','他曾進入房間','他一定說謊'],correct:1},
  {id:'pre-time',conceptId:'evidence-comparison',text:'角色說八點離開，但已確認時間的紀錄顯示八點十分仍在場，下一步應做什麼？',choices:['忽略差異','直接認定他犯案','出示紀錄並追問時間差異'],correct:2},
  {id:'pre-procedure',conceptId:'procedure-fairness',text:'兩方對同一件事的說法不同，調查時應如何處理？',choices:['讓雙方說明並核對相關資料','只聽先發言的人','用外表判斷'],correct:0}
 ],
 post:[
  {id:'post-evidence',conceptId:'fact-inference',text:'照片只顯示某人在球場旁，能直接確認什麼？',choices:['他一定打破窗戶','他一定沒有碰球','照片顯示他在球場旁'],correct:2},
  {id:'post-time',conceptId:'evidence-comparison',text:'角色說九點到達，但已確認時間的紀錄顯示八點五十分已在場，應如何處理？',choices:['核對兩項資訊並追問差異','直接認定他造成所有損害','只保留比較早的說法'],correct:0},
  {id:'post-procedure',conceptId:'procedure-fairness',text:'一段影片有遮擋，另一方提出不同解釋，應如何調查？',choices:['不讓另一方說明','聽取說明並檢查影片能證明的範圍','直接採用說話較大聲的一方'],correct:1}
 ]
};
const survey=[
 {id:'clarity',text:'我知道下一步可以進行哪些操作。'},
 {id:'evidence',text:'這次練習幫助我區分證物內容與自己的推論。'},
 {id:'followup',text:'我理解為什麼要針對說法差異進行追問。'},
 {id:'usability',text:'我能順利完成操作。'}
] as const;
export function publicEducationInstrument(){
 return {version:EDUCATION_INSTRUMENT_VERSION,validation:'draft-not-validated',
  limitation:'原創教學試題，尚未完成專家審查與量表效度驗證；分數變化不能單獨證明教育成效。',
  pre:tests.pre.map(({id,conceptId,text,choices})=>({id,conceptId,text,choices:[...choices]})),
  post:tests.post.map(({id,conceptId,text,choices})=>({id,conceptId,text,choices:[...choices]})),
  survey:survey.map(q=>({...q})),scale:{min:1,max:5,labels:['非常不同意','不同意','普通','同意','非常同意']}};
}
function exactRecord(input:unknown,keys:readonly string[]):Record<string,unknown>|null{
 if(!input||typeof input!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Reflect.ownKeys(input).length!==keys.length)return null;
 const result:Record<string,unknown>={};
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!('value'in d)||!d.enumerable)return null;result[key]=d.value;}
 return result;
}
/** Host supplies expected phase from trusted progression, not request.phase.
 * Never return this score to the player before the post-test is submitted.
 * Repeated/late submissions must be fenced by the host's existing journal.
 */
export function scoreEducationTest(input:unknown,expectedPhase:'pre'|'post'){
 try{
  if(expectedPhase!=='pre'&&expectedPhase!=='post')return null;
  const v=exactRecord(input,['version','phase','answers']);
  if(!v||v.version!==EDUCATION_INSTRUMENT_VERSION||v.phase!==expectedPhase)return null;
  const questions=tests[expectedPhase],answers=exactRecord(v.answers,questions.map(q=>q.id));if(!answers)return null;
  let score=0;
  for(const q of questions){const a=answers[q.id];if(typeof a!=='number'||!Number.isInteger(a)||a<0||a>=q.choices.length)return null;if(a===q.correct)score++;}
  return {version:EDUCATION_INSTRUMENT_VERSION,phase:expectedPhase,score,total:questions.length};
 }catch{return null;}
}
export function parseEducationSurvey(input:unknown){
 try{
  const v=exactRecord(input,['version','ratings']);if(!v||v.version!==EDUCATION_INSTRUMENT_VERSION)return null;
  const ratings=exactRecord(v.ratings,survey.map(q=>q.id));if(!ratings)return null;
  for(const rating of Object.values(ratings))if(typeof rating!=='number'||!Number.isInteger(rating)||rating<1||rating>5)return null;
  return {version:EDUCATION_INSTRUMENT_VERSION,ratings:ratings as Record<typeof survey[number]['id'],number>};
 }catch{return null;}
}
