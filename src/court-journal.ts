import {courtView, PROCEDURAL_REQUESTS, type CourtState} from './court-rules';
import {publicCourtCast,canConverse} from './court-cast';
import {appendPrivateState} from './court-private-journal';
import {investigationActionLabel} from './court-investigation';

export type JournalDetail = {kind:'session_started'|'checkpoint'|'statement'|'ruling'|'stage_changed'|'session_completed'|'npc_utterance'|'evidence_presented';requestId:string;speaker:string;roleId:string;text:string;evidenceIds?:string[]};
export function investigationJournal(s:CourtState,action:string):Partial<JournalDetail>{
 if(!s.investigation||!action.startsWith('investigate.'))return {};
 const [,kind,npc]=action.split('.'),names:Record<string,string>={Witness:'證人',Prosecutor:'檢察官',Lawyer:'辯護人'};
 return {kind:kind==='present'?'evidence_presented':kind==='question'||kind==='followUp'?'npc_utterance':'checkpoint',
  speaker:names[npc]||'系統',roleId:npc?.toLowerCase()||s.config.role,text:s.feedback,
  evidenceIds:kind==='present'||kind==='discover'?[...s.investigation.viewedEvidenceIds]:[]};
}
// Explicit public projection. Never spread CourtState or generatedCase: those
// contain owner data and answer keys. v0 facts are public in current templates;
// future role-private evidence must be filtered here before persistence.
export function publicCourtSnapshot(s:CourtState, requestId:string,eventId:string,timestamp:string){
 const v=courtView(s);
 const action=(actionId:string,label:string,category:string,requiredTarget='none')=>({actionId,label,category,requiredTarget,enabled:true,reasonDisabled:''});
 const allowedActions=v.actions.flatMap(id=>{
  if(id.startsWith('investigate.'))return [action(id,investigationActionLabel(id),'evidence')];
  if(id==='answer')return v.answers.map((label,i)=>action('answer.'+i,label,'assessment'));
  if(id==='rule')return PROCEDURAL_REQUESTS.flatMap(r=>['allow','deny'].map(d=>action('rule.'+r.id+'.'+d,(d==='allow'?'准許：':'駁回：')+r.text,'procedure')));
  const labels:Record<string,string>={acknowledge:'確認程序',speak:'提出陳述',review:'查看證物',closeEvidence:'結束調查',step:'下一步'};
  return [action(id,labels[id]||id,id==='speak'?'statement':id==='review'?'evidence':'procedure',id==='review'?'evidence':'none')];
 });
 if(canConverse(s)&&s.version<100)allowedActions.push(action('npc.ask','向角色提問','statement','npc'));
 return {apiVersion:1,requestId,caseId:s.config.caseId,sessionId:s.id,stateVersion:s.version,eventId,eventSequence:s.version,timestamp,state:{
  title:v.title,procedure:v.procedure,roleId:s.config.role,stageId:'stage-'+s.stage,stageLabel:v.stageLabel,completed:s.completed,
  allowedActions,npcs:publicCourtCast(s),evidence:v.evidence.map(e=>({evidenceId:e.id,title:e.title,type:'document',text:e.text,metadata:[],sourceRole:'court',admittedStatus:'notConsidered',presentationState:'available',factReferences:[],assetId:''})),feedback:s.feedback
 }};
}
export function journalEvent(s:CourtState,detail:JournalDetail){
 const snapshot=publicCourtSnapshot(s,detail.requestId,crypto.randomUUID(),new Date().toISOString());
 const {state,...envelope}=snapshot;
 return {...envelope,kind:detail.kind,speaker:detail.speaker,roleId:detail.roleId,stageId:state.stageId,text:detail.text,evidenceIds:detail.evidenceIds||[],citationIds:[],snapshot};
}
export type JournalEvent=ReturnType<typeof journalEvent>;

export function appendJournal(sql:SqlStorage,s:CourtState,detail:JournalDetail){
 const event=journalEvent(s,detail);
 sql.exec('INSERT INTO court_events(version,event_id,body) VALUES(?,?,?)',s.version,event.eventId,JSON.stringify(event));
 appendPrivateState(sql,s,event.eventId);
 return event;
}
export function checkpointJournal(sql:SqlStorage,s:CourtState){
 const last=sql.exec<{version:number}>('SELECT version FROM court_events ORDER BY version DESC LIMIT 1').toArray()[0];
 if(last?.version===s.version)return;
 // No invented pre-migration history. A checkpoint is an observation NOW,
 // including if an older Worker changed state after a deployment rollback.
 appendJournal(sql,s,{kind:'checkpoint',requestId:crypto.randomUUID(),speaker:'系統',roleId:s.config.role,text:'從此處開始記錄；更早的程序沒有完整事件紀錄。'});
}
