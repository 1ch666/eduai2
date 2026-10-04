import { CASES, type CaseTemplate } from './court-rules';
import type { AppEnv } from './env';
import type { LLMProvider } from './providers/contracts';
import { parseCourtNarrativeDraft } from './court-draft';
import { checkCaseReachability } from './court-reachability';

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

export function validateGenerated(value:unknown,base:CaseTemplate):CaseTemplate|null{
 const v=parseCourtNarrativeDraft(value);if(!v)return null;
 const evidence=v.evidence.map((e,i)=>({id:'generated-'+i,...e}));
 // Assessment tests reasoning, not a model-invented verdict. Procedure, ages,
 // legal assistance and legal sources remain controlled by the existing server.
 const answers=['只憑一方陳述直接作結論','先釐清資料來源與限制，再比較雙方說法','以角色外貌判斷可信度','略過有矛盾的資料'];
 for(let i=answers.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[answers[i],answers[j]]=[answers[j],answers[i]];}
 const candidate={...structuredClone(base),id:'ai-'+crypto.randomUUID(),title:'[AI虛構] '+v.title,summary:v.summary,facts:v.facts,evidence,
 question:'面對這些尚待核對的資料，哪一種調查方式較適當？',answers,correct:answers.indexOf('先釐清資料來源與限制，再比較雙方說法'),explanation:'這是 AI 生成的虛構練習，不是裁判或法律意見。應核對來源、區分事實與推測並聽取雙方說明；本題不判斷誰勝訴。'};
 return checkCaseReachability(candidate,base.id).ok?candidate:null;
}
function grams(t:CaseTemplate){const text=[...t.facts,...t.evidence.map(e=>e.text)].join('').normalize('NFKC').toLowerCase().replace(/[^\p{L}]/gu,'');return new Set(Array.from({length:Math.max(0,text.length-2)},(_,i)=>text.slice(i,i+3)));}
export function similarCase(a:CaseTemplate,b:CaseTemplate){
 const x=grams(a),y=grams(b);let common=0;for(const g of x)if(y.has(g))common++;
 return common/Math.max(1,Math.min(x.size,y.size))>=.65;
}
export async function generateModelCase(env:AppEnv,base:CaseTemplate,previous:CaseTemplate[],provider?:LLMProvider):Promise<CaseTemplate>{
 if(env.COURT_AI_ENABLED==='false'||!provider)throw Error('AI 尚未啟用或設定，未建立案件。');
 const themes=['物品交接記錄缺漏','雙方對時間順序有歧異','證人只見到片段','電子訊息缺少上下文','照片與陳述需要比對','物件來源尚待確認'];
 const theme=themes[crypto.getRandomValues(new Uint32Array(1))[0]%themes.length];
 // Server composition only; neither credentials nor provider selection are client input.
 const engine=provider;
 // Leave room for the model's reasoning tokens, but request a short narrative.
 // Admission still reserves this bounded budget; never retry a truncated draft.
 const r=await engine.generate({output:'json',temperature:.9,maxOutputTokens:3200,messages:[{role:'system',content:'產生繁體中文原創虛構教育案件。只輸出精簡JSON，整份約350至500中文字：title(4-20字)、summary(30-80字)、facts(恰好3項，每項20-50字)、evidence(恰好2項，每項只有title(4-20字)、text(40-90字))。不要法條、判決、真實人物、網址、年齡或法律協助資格。保持指定案件類型，使用「甲方、乙方」而非真名。每項證據必須說明能確認及不能確認的內容；不把主張當已證實事實。至少保留一項待查爭點。事件和證據組合須不同於避開清單，不可只換名字。內容是虛構練習，不下法律結論。'},{role:'user',content:JSON.stringify({category:base.id,procedure:base.procedure,theme,nonce:crypto.randomUUID(),avoid:previous.slice(-12).map(t=>({summary:t.summary,evidence:t.evidence.map(e=>e.title)}))})}]},{timeoutMs:40000,maxResponseBytes:18000}).catch(()=>({ok:false as const,code:'NETWORK' as const}));
 if(!r.ok&&r.code==='OUTPUT_TRUNCATED')throw Error('AI 案件輸出達長度上限，未接受不完整案件。');
 if(!r.ok&&r.code==='TIMEOUT')throw Error('AI 案件生成逾時。');
 if(!r.ok)throw Error(r.code==='QUOTA'?'AI 額度或頻率限制，未建立案件。':['RESPONSE_TOO_LARGE','INVALID_ENCODING','RESPONSE_FORMAT','OUTPUT_TRUNCATED','EMPTY_CONTENT'].includes(r.code)?'AI 案件格式不合格，未建立案件。':'AI 服務暫時無法生成案件。');
 let result:CaseTemplate|null=null;
 try{if(new TextEncoder().encode(r.value.text).byteLength<=18000)result=validateGenerated(JSON.parse(r.value.text),base);}catch{}
 if(!result)throw Error('AI 案件格式不合格，未建立案件。');
 return result;
}
