import { CASES, type CaseTemplate } from './court-rules';

// Versioned, reviewed teaching building blocks. Never accept model-authored law,
// answers or facts. Variations change the evidence limitation, not just names.
export const GENERATION_VERSION='evidence-variants-2026-09-26';
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
