import { CASES, type CaseTemplate } from './court-rules';
import type { AppEnv } from './env';
import { readTextWithLimit } from './http';

// Versioned, reviewed teaching building blocks. Never accept model-authored law,
// answers or facts. Variations change the evidence limitation, not just names.
export const GENERATION_VERSION='ai-fiction-2026-09-26';
const additions=[
 {id:'fragment',title:'片段資料的限制',text:'補充資料只有事件的一小段，前後經過仍缺漏；片段不能證明完整經過。'},
 {id:'retelling',title:'轉述的限制',text:'補充說法來自他人轉述，提供者並未親眼見到爭議行為；須追查原始來源。'},
 {id:'timing',title:'時間線的限制',text:'補充紀錄的時間尚未與原始來源核對，先後順序不能僅由顯示時間認定。'}
];
export function generatedCandidates(caseId:string):CaseTemplate[]{
 const base=CASES.find(c=>c.id===caseId);if(!base)return [];
 return additions.map(e=>({...structuredClone(base),id:base.id+'-'+e.id,title:base.title+'：'+e.title,
  facts:[...base.facts,'補充資料仍有以下待查限制：'+e.text],evidence:[...base.evidence,{...e}],
  summary:base.summary+' 本輪加查：'+e.title+'。'}));
}

// Select only within the chosen legal template: switching procedure or counsel
// requirements behind the user's back would invalidate the selected config.
export function randomLibraryCase(caseId:string,history:CaseTemplate[]):CaseTemplate{
 const pool=generatedCandidates(caseId);
 if(!pool.length)throw Error('找不到案件類型');
 const counts=new Map(pool.map(t=>[t.id,history.filter(h=>h.id===t.id).length]));
 const minimum=Math.min(...counts.values());
 let candidates=pool.filter(t=>counts.get(t.id)===minimum);
 const last=history.filter(h=>counts.has(h.id)).at(-1)?.id;
 const withoutLast=candidates.filter(t=>t.id!==last);if(withoutLast.length)candidates=withoutLast;
 const selected=structuredClone(candidates[crypto.getRandomValues(new Uint32Array(1))[0]%candidates.length]);
 const correct=selected.answers[selected.correct];
 for(let i=selected.answers.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[selected.answers[i],selected.answers[j]]=[selected.answers[j],selected.answers[i]];}
 selected.correct=selected.answers.indexOf(correct);
 selected.title='[題庫] '+selected.title;
 return selected;
}

const clean=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>=4&&v.length<=max&&!/[<>]|https?:|第[零一二三四五六七八九十百千\d]+條|判處|判決有罪/.test(v);
export function validateGenerated(value:unknown,base:CaseTemplate):CaseTemplate|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['title','summary','facts','evidence'].includes(k))||!clean(v.title,60)||!clean(v.summary,260)||!Array.isArray(v.facts)||v.facts.length<3||v.facts.length>6||!v.facts.every(f=>clean(f,220))||!Array.isArray(v.evidence)||v.evidence.length<2||v.evidence.length>4)return null;
 const evidence:CaseTemplate['evidence']=[];
 for(const [i,item] of v.evidence.entries()){
  if(!item||typeof item!=='object'||Array.isArray(item))return null;
  const e=item as Record<string,unknown>;
  if(Object.keys(e).some(k=>!['title','text'].includes(k))||!clean(e.title,60)||!clean(e.text,300))return null;
  evidence.push({id:'generated-'+i,title:e.title,text:e.text});
 }
 // Assessment tests reasoning, not a model-invented verdict. Procedure, ages,
 // legal assistance and legal sources remain controlled by the existing server.
 const answers=['只憑一方陳述直接作結論','先釐清資料來源與限制，再比較雙方說法','以角色外貌判斷可信度','略過有矛盾的資料'];
 for(let i=answers.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[answers[i],answers[j]]=[answers[j],answers[i]];}
 return {...structuredClone(base),id:'ai-'+crypto.randomUUID(),title:'[AI虛構] '+v.title,summary:v.summary,facts:v.facts as string[],evidence,
 question:'面對這些尚待核對的資料，哪一種調查方式較適當？',answers,correct:answers.indexOf('先釐清資料來源與限制，再比較雙方說法'),explanation:'這是 AI 生成的虛構練習，不是裁判或法律意見。應核對來源、區分事實與推測並聽取雙方說明；本題不判斷誰勝訴。'};
}
function grams(t:CaseTemplate){const text=[...t.facts,...t.evidence.map(e=>e.text)].join('').normalize('NFKC').toLowerCase().replace(/[^\p{L}]/gu,'');return new Set(Array.from({length:Math.max(0,text.length-2)},(_,i)=>text.slice(i,i+3)));}
export function similarCase(a:CaseTemplate,b:CaseTemplate){
 const x=grams(a),y=grams(b);let common=0;for(const g of x)if(y.has(g))common++;
 return common/Math.max(1,Math.min(x.size,y.size))>=.65;
}
export async function generateModelCase(env:AppEnv,base:CaseTemplate,previous:CaseTemplate[]):Promise<CaseTemplate>{
 if(env.COURT_AI_ENABLED==='false'||!env.OLLAMA_API_KEY)throw Error('AI 尚未啟用或設定，未建立案件。');
 const themes=['物品交接記錄缺漏','雙方對時間順序有歧異','證人只見到片段','電子訊息缺少上下文','照片與陳述需要比對','物件來源尚待確認'];
 const theme=themes[crypto.getRandomValues(new Uint32Array(1))[0]%themes.length];
 const r=await fetch('https://ollama.com/api/chat',{method:'POST',headers:{Authorization:`Bearer ${env.OLLAMA_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({model:env.OLLAMA_MODEL||'gpt-oss:20b',stream:false,think:false,format:'json',options:{temperature:.9,num_predict:1600},messages:[{role:'system',content:'產生繁體中文原創虛構教育案件。只輸出JSON：title(4-60字)、summary(4-260字)、facts(3-6項，每項4-220字)、evidence(2-4項，每項只有title(4-60字)、text(4-300字))。不要法條、判決、真實人物、網址、年齡或法律協助資格。保持指定案件類型，使用「甲方、乙方」而非真名。每項證據必須說明能確認及不能確認的內容；不把主張當已證實事實。至少保留一項待查爭點。事件和證據組合須不同於避開清單，不可只換名字。內容是虛構練習，不下法律結論。'},{role:'user',content:JSON.stringify({category:base.id,procedure:base.procedure,theme,nonce:crypto.randomUUID(),avoid:previous.slice(-12).map(t=>({summary:t.summary,evidence:t.evidence.map(e=>e.title)}))})}]})});
 if(!r.ok)throw Error(r.status===429?'AI 額度或頻率限制，未建立案件。':'AI 服務暫時無法生成案件。');
 const raw=await readTextWithLimit(r.body,18000);if(raw.tooLarge||raw.invalidEncoding)throw Error('AI 案件格式不合格，未建立案件。');
 let result:CaseTemplate|null=null;
 try{const envelope=JSON.parse(raw.text);result=validateGenerated(JSON.parse(envelope?.message?.content||''),base);}catch{}
 if(!result)throw Error('AI 案件格式不合格，未建立案件。');
 return result;
}
