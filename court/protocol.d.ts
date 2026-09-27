export interface CourtMutation {
 apiVersion:1; requestId:string; idempotencyKey:string; sessionId:string;
 caseId:string; expectedStateVersion:number; actionId:string; targetId:string; text:string;
}
export function parseMutation(raw:string):CourtMutation|null;
export function parseSnapshot(raw:string):unknown;
export function parseEvent(raw:string):unknown;
export function canonical(value:unknown):string;
export const API_VERSION:number;
export const MAX_PROTOCOL_BYTES:number;
