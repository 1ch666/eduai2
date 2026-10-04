// Authored teaching rules. Server-only; not yet wired to production CourtRoom.
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
  objectives:[{id:'question-roles',done:d.npcs.every(id=>s.questionedNpcIds.includes(id))},
   {id:'key-evidence',done:s.viewedEvidenceIds.includes(d.evidence.id)},
   {id:'reasoning',done:s.foundContradictionIds.includes(c.contradictionId)}]};
}
