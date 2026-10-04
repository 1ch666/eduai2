// Authored teaching rules. Server-only; no model output grants discoveries.
import type {CaseTemplate} from './court-rules';
// The caller must commit with the existing version/idempotency/journal boundary.
export type Contradiction = {
 contradictionId:string;statementFactId:string;evidenceFactId:string;relatedNpcId:string;
 type:'timeline';severity:'major';explanation:string;
 unlockCondition:{evidenceId:string;requiresStatement:true};
};
export const TABLET_INVESTIGATION = {
 id:'tablet-time-discrepancy-v1',
 npcs:['Witness','Prosecutor','Lawyer'],
 statement:{npcId:'Witness',factId:'witness-left-2000',text:'我在 20:00 就離開現場了。'},
 evidence:{id:'camera-time',factId:'camera-present-2017',title:'走廊影像時間紀錄',text:'本教學案已確認時間的影像顯示：證人於 20:17 仍在現場。'},
 contradiction:{contradictionId:'departure-time',statementFactId:'witness-left-2000',evidenceFactId:'camera-present-2017',
  relatedNpcId:'Witness',type:'timeline',severity:'major',
  explanation:'證人說 20:00 已離開，已確認時間的影像卻顯示 20:17 仍在現場，兩項時間說法不能同時成立。這不等於已證明任何人取走平板，仍須釐清離開時間及記憶是否有誤。',
  unlockCondition:{evidenceId:'camera-time',requiresStatement:true}} satisfies Contradiction,
} as const;
export const INVESTIGATION_TEMPLATE:CaseTemplate={
 id:TABLET_INVESTIGATION.id,title:'平板失蹤：十七分鐘的落差',procedure:'criminal',
 summary:'虛構教學案件：平板失蹤後，需釐清證人的離場時間。時間矛盾不等於已證明竊盜。',
 facts:['教室平板一度找不到。','被告否認取走平板。'],
 evidence:[{id:TABLET_INVESTIGATION.evidence.id,title:TABLET_INVESTIGATION.evidence.title,text:TABLET_INVESTIGATION.evidence.text}],
 question:'時間矛盾能支持哪一項判讀？',
 answers:['證人必然就是竊賊','任何矛盾都可以忽略','應追問離場時間，不能直接推論誰取走平板','被告必然有罪'],
 correct:2,explanation:TABLET_INVESTIGATION.contradiction.explanation,mandatory:false,aidApproved:false
};
export const INVESTIGATION_LINES:Readonly<Record<string,string>>={
 Witness:TABLET_INVESTIGATION.statement.text,
 Prosecutor:'本案仍須核對離場時間與資料，不能只因有人在場就認定取走平板。',
 Lawyer:'請區分時間紀錄與取走平板這兩件事；一項證詞有疑問，不代表已查明全部經過。'
};
export type InvestigationState={
 caseId:typeof TABLET_INVESTIGATION.id;questionedNpcIds:string[];heardFactIds:string[];
 viewedEvidenceIds:string[];presentations:string[];foundContradictionIds:string[];
 followedContradictionIds:string[];hintCount:number;
};
export type InvestigationAction=
 |{type:'question';npcId:string}|{type:'view';evidenceId:string}
 |{type:'present';npcId:string;evidenceId:string}|{type:'followUp';npcId:string;contradictionId:string}|{type:'hint'};
export type InvestigationContext={stage:number;completed:boolean;role:string;availableEvidenceIds:readonly string[];responsiveNpcIds:readonly string[]};
export function newInvestigation():InvestigationState{return {caseId:TABLET_INVESTIGATION.id,questionedNpcIds:[],heardFactIds:[],viewedEvidenceIds:[],presentations:[],foundContradictionIds:[],followedContradictionIds:[],hintCount:0};}
const add=(list:string[],id:string)=>{if(!list.includes(id))list.push(id);};
const reject=()=>{throw new Error('Investigation action not allowed');};
/** Input must already be bounded plain JSON (the private-state parser owns that boundary). */
export function parseInvestigation(value:unknown):InvestigationState|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>,d=TABLET_INVESTIGATION;
 const fields=['caseId','questionedNpcIds','heardFactIds','viewedEvidenceIds','presentations','foundContradictionIds','followedContradictionIds','hintCount'];
 if(Object.keys(v).length!==fields.length||!fields.every(k=>Object.hasOwn(v,k))||v.caseId!==d.id||
  !Number.isSafeInteger(v.hintCount)||Number(v.hintCount)<0||Number(v.hintCount)>100)return null;
 const valid=(key:string,ids:readonly string[])=>Array.isArray(v[key])&&v[key].length<=ids.length&&
  v[key].every(x=>typeof x==='string'&&ids.includes(x))&&new Set(v[key]).size===v[key].length;
 if(!valid('questionedNpcIds',d.npcs)||!valid('heardFactIds',[d.statement.factId])||!valid('viewedEvidenceIds',[d.evidence.id])||
  !valid('presentations',d.npcs.map(id=>id+':'+d.evidence.id))||!valid('foundContradictionIds',[d.contradiction.contradictionId])||
  !valid('followedContradictionIds',[d.contradiction.contradictionId]))return null;
 const s=v as InvestigationState;
 if(s.heardFactIds.length!==Number(s.questionedNpcIds.includes('Witness'))||
  s.presentations.length&&!s.viewedEvidenceIds.length||
  s.foundContradictionIds.length&&(!s.heardFactIds.length||!s.presentations.includes('Witness:'+d.evidence.id))||
  s.followedContradictionIds.length&&!s.foundContradictionIds.length)return null;
 return structuredClone(s);
}
export function investigationActionIds(s:InvestigationState):string[]{
 return [...TABLET_INVESTIGATION.npcs.map(id=>'investigate.question.'+id),'investigate.discover',
  ...(s.viewedEvidenceIds.length?TABLET_INVESTIGATION.npcs.map(id=>'investigate.present.'+id):[]),
  ...(s.foundContradictionIds.length?['investigate.followUp.Witness']:[]),'investigate.hint'];
}
export function investigationActionLabel(id:string):string{
 const name:Record<string,string>={Witness:'證人',Prosecutor:'檢察官',Lawyer:'辯護人'};
 const [,kind,npc]=id.split('.');
 return kind==='question'?'詢問'+name[npc]+'（案件原始陳述）':kind==='present'?'出示已取得證物給'+name[npc]:
  kind==='discover'?'調查現場紀錄':kind==='followUp'?'追問時間矛盾':kind==='hint'?'取得推理提示':id;
}
export function investigationCommand(s:InvestigationState,id:string,context:InvestigationContext){
 if(!investigationActionIds(s).includes(id))return reject();
 const [,kind,npcId]=id.split('.'),d=TABLET_INVESTIGATION;
 const action:InvestigationAction=kind==='question'?{type:'question',npcId}:kind==='discover'?{type:'view',evidenceId:d.evidence.id}:
  kind==='present'?{type:'present',npcId,evidenceId:d.evidence.id}:kind==='followUp'?{type:'followUp',npcId,contradictionId:d.contradiction.contradictionId}:{type:'hint'};
 const state=reduceInvestigation(s,action,context);
 const text=kind==='question'?'【案件原始陳述】'+INVESTIGATION_LINES[npcId]:kind==='discover'?d.evidence.title+'：'+d.evidence.text:
  kind==='present'?(state.foundContradictionIds.length>s.foundContradictionIds.length?'已發現時間矛盾。'+d.contradiction.explanation:'已出示證物；請核對該角色的原始陳述。'):
  kind==='followUp'?'【預寫教學回應・證人】我的離場時間說法與你出示的紀錄不一致，需要重新核對；目前不能據此判斷誰拿走平板。':
  '先詢問證人的離場時間，再調查現場紀錄，將取得的證物出示給證人。';
 return {state,text};
}
/** question is a server-confirmed interaction, not a client assertion of success.
 * No model output is accepted as a contradiction, fact, score or verdict.
 */
export function reduceInvestigation(state:InvestigationState,action:InvestigationAction,context:InvestigationContext):InvestigationState{
 if(state.caseId!==TABLET_INVESTIGATION.id||context.completed||context.stage!==2||
  !['judge','claimant','respondent','claimantCounsel','respondentCounsel'].includes(context.role))return reject();
 const next=structuredClone(state),definition=TABLET_INVESTIGATION,c=definition.contradiction;
 if('npcId' in action&&(!definition.npcs.some(id=>id===action.npcId)||!context.responsiveNpcIds.includes(action.npcId)))return reject();
 if('evidenceId' in action&&(action.evidenceId!==definition.evidence.id||!context.availableEvidenceIds.includes(action.evidenceId)))return reject();
 switch(action.type){
  case 'question':
   add(next.questionedNpcIds,action.npcId);
   if(action.npcId===definition.statement.npcId)add(next.heardFactIds,definition.statement.factId);
   break;
  case 'view':add(next.viewedEvidenceIds,action.evidenceId);break;
  case 'present':
   if(!next.viewedEvidenceIds.includes(action.evidenceId))return reject();
   add(next.presentations,action.npcId+':'+action.evidenceId);
   if(action.npcId===c.relatedNpcId&&action.evidenceId===c.unlockCondition.evidenceId&&next.heardFactIds.includes(c.statementFactId))add(next.foundContradictionIds,c.contradictionId);
   break;
  case 'followUp':
   if(action.npcId!==c.relatedNpcId||action.contradictionId!==c.contradictionId||!next.foundContradictionIds.includes(c.contradictionId))return reject();
   add(next.followedContradictionIds,c.contradictionId);break;
  case 'hint':
   if(!Number.isSafeInteger(next.hintCount)||next.hintCount<0||next.hintCount>=100)return reject();
   next.hintCount++;break;
  default:return reject();
 }
 return next;
}
/** Allowlisted board: never returns unrevealed evidence or total contradictions. */
export function investigationBoard(s:InvestigationState){
 const d=TABLET_INVESTIGATION,c=d.contradiction;
 return {evidence:s.viewedEvidenceIds.includes(d.evidence.id)?[{id:d.evidence.id,title:d.evidence.title,text:d.evidence.text}]:[],
  questionedNpcIds:d.npcs.filter(id=>s.questionedNpcIds.includes(id)),
  statements:s.heardFactIds.includes(d.statement.factId)?[{npcId:d.statement.npcId,text:d.statement.text}]:[],
  contradictions:s.foundContradictionIds.includes(c.contradictionId)?[{contradictionId:c.contradictionId,relatedNpcId:c.relatedNpcId,explanation:c.explanation,
   followUpLabel:'追問時間矛盾',followed:s.followedContradictionIds.includes(c.contradictionId)}]:[],
  objectives:[{id:'question-roles',label:'詢問三名角色的原始陳述',done:d.npcs.every(id=>s.questionedNpcIds.includes(id))},
   {id:'key-evidence',label:'調查關鍵證物',done:s.viewedEvidenceIds.includes(d.evidence.id)},
   {id:'reasoning',label:'找出陳述與證物的矛盾',done:s.foundContradictionIds.includes(c.contradictionId)},
   {id:'follow-up',label:'完成矛盾追問',done:s.followedContradictionIds.includes(c.contradictionId)}]};
}
export function investigationDebrief(s:InvestigationState,finalJudgment:string){
 const d=TABLET_INVESTIGATION;
 return {
  evidenceCoverage:s.viewedEvidenceIds.includes(d.evidence.id)?100:0,
  npcCoverage:Math.round(d.npcs.filter(id=>s.questionedNpcIds.includes(id)).length/d.npcs.length*100),
  contradictionsFound:s.foundContradictionIds.length,hintsUsed:s.hintCount,procedureCompletion:100,finalJudgment,
  concepts:['事實與推論','證詞與時間紀錄的核對','矛盾不等於證明犯罪'],
  improvements:[...(!s.viewedEvidenceIds.length?['忽略關鍵證物']:[]),
   ...(s.questionedNpcIds.length<d.npcs.length?['未完整詢問']:[]),
   ...(!s.foundContradictionIds.length?['未發現矛盾']:[]),
   ...(!s.followedContradictionIds.length?['尚未追問矛盾']:[])],
  limitation:'只依已記錄行為提供回顧；不以模型評语或關鍵字判定論證能力，不列入競賽排名。',
  reasoning:s.foundContradictionIds.length?[d.statement.text,d.evidence.text,d.contradiction.explanation]:[]
 };
}
