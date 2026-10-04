import {parseCourtWire} from '../court/protocol.js';
import {validateConfig,type CourtConfig} from './court-rules';
export type CourtCreation={apiVersion:2;requestId:string;idempotencyKey:string;sessionId:string;expectedStateVersion:0;config:CourtConfig};
const keys=(v:unknown,names:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function parseCreation(raw:string):CourtCreation|null{
 if(raw.length>4096||new TextEncoder().encode(raw).byteLength>4096)return null;
 const v=parseCourtWire(raw);
 if(!keys(v,['apiVersion','requestId','idempotencyKey','sessionId','expectedStateVersion','config'])||v.apiVersion!==2||v.expectedStateVersion!==0||
  !uuid(v.requestId)||!uuid(v.idempotencyKey)||typeof v.sessionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.sessionId))return null;
 const c=v.config;
 if(!keys(c,['caseId','role','claimantAge','claimantHearingAge','respondentAge','respondentHearingAge','claimantAid','respondentAid']))return null;
 // validateConfig is the same deterministic authority used by legacy creation.
 const config=c as CourtConfig;
 if(validateConfig(config))return null;
 // Wire objects deliberately have null prototypes; RPC DTOs must be plain records.
 return {apiVersion:2,requestId:v.requestId as string,idempotencyKey:v.idempotencyKey as string,sessionId:v.sessionId,expectedStateVersion:0,config:{...config}};
}
