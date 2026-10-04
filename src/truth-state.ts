import {CASES,type CourtState,type CaseTemplate} from './court-rules';
import {NPC_IDS,type NpcId} from './court-cast';
import {TABLET_INVESTIGATION,INVESTIGATION_LINES} from './court-investigation';

// Server-only case truth. Every item names the roles allowed to know it; an
// empty holder list means no agent may ever receive it (answer key, rubric).
// This is a data boundary applied before any model call, not a prompt rule.
export type TruthKind='instruction'|'summary'|'fact'|'evidence'|'testimony'|'answer-key';
export type TruthItem={readonly sourceId:string;readonly kind:TruthKind;readonly text:string;readonly holders:readonly NpcId[]};
export type TruthState={readonly caseId:string;readonly procedure:CaseTemplate['procedure'];readonly items:readonly TruthItem[]};
export type ProjectedItem={sourceId:string;kind:TruthKind;text:string};
export type KnowledgeProjection={role:NpcId;items:ProjectedItem[]};

const JUDGE_INSTRUCTION='請依序確認程序權利、聽取陳述、調查證據及表達意見。';
const LAWYER_INSTRUCTION='請分清楚已知事實與推論；資料未記載的部分不能自行補足。';
// Evidence that records a witness's own account. The witness knows their own
// statement; other roles see it only as ordinary evidence.
export const isTestimony=(e:{id:string;title:string})=>/witness|accounts/.test(e.id)||/證人|目擊|證詞/.test(e.title);

export function buildTruthState(s:CourtState):TruthState{
 const t=s.generatedCase||CASES.find(c=>c.id===s.config.caseId);
 if(!t)throw Error('unknown case');
 if(s.investigation){
  if(s.generatedCase||s.config.caseId!==TABLET_INVESTIGATION.id)throw Error('invalid investigation');
  const d=TABLET_INVESTIGATION;
  const items:TruthItem[]=[
   {sourceId:'instruction:judge',kind:'instruction',text:JUDGE_INSTRUCTION,holders:['Judge']},
   ...d.npcs.map((id):TruthItem=>({sourceId:'statement:'+id,kind:'testimony',text:INVESTIGATION_LINES[id],holders:[id]})),
   {sourceId:'defendant-account',kind:'fact',text:'我否認取走平板；本案沒有提供我更多親見經過。',holders:['Defendant']},
   {sourceId:'evidence:'+d.evidence.id,kind:'evidence',text:d.evidence.text,
    holders:s.investigation.viewedEvidenceIds.includes(d.evidence.id)?d.npcs.filter(id=>s.investigation!.presentations.includes(id+':'+d.evidence.id)):[]}
  ];
  return Object.freeze({caseId:t.id,procedure:t.procedure,items:Object.freeze(items.map(i=>Object.freeze({...i,holders:Object.freeze([...i.holders])})))});
 }
 const items:TruthItem[]=[
  {sourceId:'instruction:judge',kind:'instruction',text:JUDGE_INSTRUCTION,holders:['Judge']},
  {sourceId:'summary',kind:'summary',text:t.summary,holders:['Judge','Prosecutor','Witness']},
  {sourceId:'instruction:lawyer',kind:'instruction',text:LAWYER_INSTRUCTION,holders:['Lawyer']},
  ...t.evidence.map((e):TruthItem=>({sourceId:'evidence:'+e.id,kind:isTestimony(e)?'testimony':'evidence',text:e.text,
   holders:isTestimony(e)?['Lawyer','Witness']:['Lawyer']})),
  // Legacy scope: the defendant speaks only to the first two case facts.
  ...t.facts.map((text,i):TruthItem=>({sourceId:'fact-'+i,kind:'fact',text,holders:i<2?['Defendant']:[]})),
  {sourceId:'answer-key',kind:'answer-key',text:JSON.stringify({question:t.question,answers:t.answers,correct:t.correct,explanation:t.explanation}),holders:[]},
 ];
 return Object.freeze({caseId:t.id,procedure:t.procedure,items:Object.freeze(items.map(i=>Object.freeze({...i,holders:Object.freeze([...i.holders])})))});
}

/** What `role` may lawfully know. Default deny: an item is returned only when
 * the role is an explicit holder. When `admittedEvidenceIds` is given, ordinary
 * evidence is limited to admitted items; a witness's own testimony is not.
 * The player's question is deliberately not an input, so no wording can widen
 * the result. */
export function projectKnowledge(truth:TruthState,role:NpcId,options:{admittedEvidenceIds?:readonly string[]}={}):KnowledgeProjection{
 if(!NPC_IDS.includes(role))throw Error('unknown role');
 const admitted=options.admittedEvidenceIds&&new Set(options.admittedEvidenceIds.map(id=>'evidence:'+id));
 const visible=(i:TruthItem)=>{
  if(!i.holders.includes(role))return false;
  if(!admitted||!i.sourceId.startsWith('evidence:'))return true;
  return role==='Witness'&&i.kind==='testimony'||admitted.has(i.sourceId);
 };
 return {role,items:truth.items.filter(visible).map(i=>({sourceId:i.sourceId,kind:i.kind,text:i.text}))};
}
