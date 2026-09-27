import {CASES, type CourtState, type Procedure} from './court-rules';

// Presentation identities for the existing five teaching NPCs. These are NOT
// findings about legally required attendance or private role knowledge.
export const NPC_IDS = ['Judge','Prosecutor','Lawyer','Defendant','Witness'] as const;
export type NpcId = typeof NPC_IDS[number];
export const isNpcId = (value:unknown):value is NpcId => typeof value==='string'&&NPC_IDS.some(id=>id===value);

export function npcIdentity(procedure:Procedure,id:NpcId){
 const common={Judge:{roleId:'judge',displayName:'法官',seatId:'judge-seat'},Witness:{roleId:'witness',displayName:'證人',seatId:'witness-seat'}};
 if(id==='Judge'||id==='Witness')return common[id];
 if(id==='Prosecutor')return procedure==='civil'?{roleId:'claimant',displayName:'原告',seatId:'claimant-seat'}:
  procedure==='juvenile'?{roleId:'investigator',displayName:'少年調查官',seatId:'investigator-seat'}:{roleId:'prosecutor',displayName:'檢察官',seatId:'prosecutor-seat'};
 if(id==='Defendant')return {roleId:procedure==='juvenile'?'juvenile':'respondent',displayName:procedure==='juvenile'?'少年':'被告',seatId:'respondent-seat'};
 return {roleId:procedure==='juvenile'?'assistant':'counsel',displayName:procedure==='juvenile'?'少年輔佐人':'律師',seatId:'counsel-seat'};
}

// Same eligibility predicate is used by the legacy NPC endpoint and the public
// projection. A display flag is never sufficient authorization for a request.
export function canConverse(s:CourtState){
 return !s.completed&&s.config.role!=='observer'&&s.stage<=3;
}

export function publicCourtCast(s:CourtState){
 const procedure=(s.generatedCase||CASES.find(c=>c.id===s.config.caseId))?.procedure;
 if(!procedure)return [];
 return NPC_IDS.map(npcId=>({npcId,...npcIdentity(procedure,npcId),pose:'sitting',emotion:'neutral',speakingState:'silent',visible:true,interactable:canConverse(s),requestState:'idle'}));
}
