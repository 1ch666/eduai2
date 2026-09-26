// Protocol v1 public projections only. Not a server authorization mechanism.
export const API_VERSION = 1;
export const MAX_PROTOCOL_BYTES = 262144;
const text = (max, min=0) => v => typeof v === 'string' && v.length >= min && v.length <= max;
const id = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(v);
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const integer = v => Number.isSafeInteger(v) && v >= 0;
const bool = v => typeof v === 'boolean';
const one = (...values) => v => values.includes(v);
const list = (check, max) => v => Array.isArray(v) && v.length <= max && v.every(check);
function record(shape) {
 return v => v !== null && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === Object.keys(shape).length && Object.entries(shape).every(([k,check])=>Object.hasOwn(v,k)&&check(v[k]));
}
const unique = (rows,key) => new Set(rows.map(row=>row[key])).size === rows.length;
const timestamp = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v;
const envelope = {apiVersion:one(API_VERSION),requestId:uuid,caseId:id,sessionId:uuid,stateVersion:integer,eventId:uuid,eventSequence:integer,timestamp};
const action = record({actionId:id,label:text(160,1),category:one('procedure','statement','evidence','objection','assessment','navigation'),enabled:bool,reasonDisabled:text(300),requiredTarget:one('none','evidence','npc')});
const npc = record({npcId:id,roleId:id,displayName:text(80,1),seatId:id,pose:one('idle','speaking','listening','thinking','objecting','presentingEvidence','sitting','standing','turnHeadToSpeaker'),emotion:one('neutral','nervous','confident','surprised'),speakingState:one('silent','speaking'),visible:bool,interactable:bool,requestState:one('idle','pending','failed')});
const evidence = record({evidenceId:id,title:text(160,1),type:one('image','document','chat','timeline','audioTranscript','objectPhoto','mapDiagram','syntheticRecord','cctvStill'),text:text(12000),metadata:list(record({name:text(80,1),value:text(500)}),20),sourceRole:id,admittedStatus:one('notConsidered','admitted','excluded'),presentationState:one('available','presented'),factReferences:list(id,30),assetId:v=>v===''||id(v)});
const state = record({title:text(160,1),procedure:one('civil','criminal','juvenile'),roleId:id,stageId:id,stageLabel:text(160,1),completed:bool,allowedActions:list(action,40),npcs:list(npc,30),evidence:list(evidence,40),feedback:text(5000)});
function validState(v) {
 return state(v) && unique(v.allowedActions,'actionId') && unique(v.npcs,'npcId') && unique(v.evidence,'evidenceId') &&
  v.allowedActions.every(a=>a.enabled||a.reasonDisabled.trim().length>0) &&
  v.npcs.every(n=>n.visible||!n.interactable) && !(v.procedure==='juvenile'&&v.roleId==='observer');
}
const snapshot = record({...envelope,state:validState});
const event = record({...envelope,kind:one('session_started','statement','npc_utterance','evidence_presented','objection','ruling','stage_changed','session_completed','checkpoint'),speaker:text(80),roleId:id,stageId:id,text:text(12000),evidenceIds:list(id,40),citationIds:list(id,30),snapshot});
const mutation = record({apiVersion:one(API_VERSION),requestId:uuid,idempotencyKey:uuid,sessionId:uuid,caseId:id,expectedStateVersion:integer,actionId:id,targetId:v=>v===''||id(v),text:text(600)});
function parse(raw, check) {
 if (typeof raw !== 'string' || raw.length > MAX_PROTOCOL_BYTES || new TextEncoder().encode(raw).byteLength > MAX_PROTOCOL_BYTES) return null;
 try { const value=JSON.parse(raw); return check(value)?value:null; } catch { return null; }
}
export const parseSnapshot = raw => parse(raw,snapshot);
export const parseMutation = raw => parse(raw,mutation);
export const parseEvent = raw => parse(raw,v=>event(v) &&
 Object.keys(envelope).every(k=>v[k]===v.snapshot[k]) && v.stageId===v.snapshot.state.stageId &&
 new Set(v.evidenceIds).size===v.evidenceIds.length &&
 v.evidenceIds.every(id=>v.snapshot.state.evidence.some(e=>e.evidenceId===id)));

// Stable field order for comparing JSON objects; array order remains meaningful.
export function canonical(value) {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
