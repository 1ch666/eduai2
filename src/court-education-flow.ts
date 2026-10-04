import { EDUCATION_INSTRUMENT_VERSION, publicEducationInstrument, scoreEducationTest, parseEducationSurvey } from './court-education-instrument.ts';

// Internal server state only. The host must load it from owned storage and commit
// atomically with its existing version/idempotency journal. Never accept it from
// a browser. This module deliberately performs no collection or persistence.
type Score=NonNullable<ReturnType<typeof scoreEducationTest>>;
type Survey=NonNullable<ReturnType<typeof parseEducationSurvey>>;
export type EducationFlow={
 version:string; revision:number;
 phase:'off'|'pre'|'playing'|'post'|'survey'|'complete'|'withdrawn';
 pre:Score|null; post:Score|null; survey:Survey|null;
};
export type EducationAction=
 | {kind:'consent'} | {kind:'withdraw'}
 | {kind:'pre';submission:unknown} | {kind:'post';submission:unknown}
 | {kind:'survey';submission:unknown} | {kind:'case_completed'};
// Facts below must be derived by the host from its authoritative case, NOT the
// request body. Completion does not imply permission to collect without consent.
type CaseProgress='not_started'|'active'|'completed';
export function newEducationFlow():EducationFlow{
 return {version:EDUCATION_INSTRUMENT_VERSION,revision:0,phase:'off',pre:null,post:null,survey:null};
}
export function transitionEducationFlow(state:EducationFlow,action:EducationAction,expectedRevision:number,progress:CaseProgress):EducationFlow|null{
 if(state.version!==EDUCATION_INSTRUMENT_VERSION||!Number.isSafeInteger(state.revision)||state.revision<0||state.revision>=Number.MAX_SAFE_INTEGER||expectedRevision!==state.revision)return null;
 if(!['not_started','active','completed'].includes(progress))return null;
 const next={...state,revision:state.revision+1};
 if(action.kind==='withdraw'){
  if(state.phase==='withdrawn')return null;
  return {...newEducationFlow(),revision:next.revision,phase:'withdrawn'};
 }
 if(action.kind==='consent')return state.phase==='off'&&progress==='not_started'?{...next,phase:'pre'}:null;
 if(action.kind==='pre'){
  if(state.phase!=='pre'||progress!=='not_started')return null;
  const score=scoreEducationTest(action.submission,'pre');
  return score?{...next,phase:'playing',pre:score}:null;
 }
 if(action.kind==='case_completed')return state.phase==='playing'&&progress==='completed'?{...next,phase:'post'}:null;
 if(action.kind==='post'){
  if(state.phase!=='post'||progress!=='completed')return null;
  const score=scoreEducationTest(action.submission,'post');
  return score?{...next,phase:'survey',post:score}:null;
 }
 if(action.kind==='survey'){
  if(state.phase!=='survey'||progress!=='completed')return null;
  const survey=parseEducationSurvey(action.submission);
  return survey?{...next,phase:'complete',survey}:null;
 }
 return null;
}
export function educationFlowView(state:EducationFlow){
 const instrument=publicEducationInstrument();
 const questions=state.phase==='pre'?instrument.pre:state.phase==='post'?instrument.post:[];
 // Explicit projection: no stored answers, survey ratings, hidden form or keys.
 return {version:state.version,revision:state.revision,phase:state.phase,
  limitation:instrument.limitation,questions,
  survey:state.phase==='survey'?instrument.survey:[],
  scale:state.phase==='survey'?instrument.scale:null,
  results:(state.phase==='survey'||state.phase==='complete')&&state.pre&&state.post?
   {pre:{score:state.pre.score,total:state.pre.total},post:{score:state.post.score,total:state.post.total}}:null};
}
