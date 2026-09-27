import {parseEvent,parseMutation,canonical} from '../court/protocol.js';
import type {JournalEvent} from './court-journal';

/** Public audit projection, not authoritative state backup. Missing historical
 * command metadata is unknown, never fabricated from version minus one.
 * Verify the stored command's exact resulting event, not only its request ID.
 */
export function publicAuditEvent(event:JournalEvent,receipt?:{payload:string;event:string}){
 if(!parseEvent(JSON.stringify(event)))throw Error('Invalid persisted public event');
 const command=receipt?parseMutation(receipt.payload):null;
 const result=receipt?parseEvent(receipt.event):null;
 const verified=!!command&&!!result&&command.requestId===event.requestId&&command.sessionId===event.sessionId&&
  command.caseId===event.caseId&&command.expectedStateVersion+1===event.stateVersion&&canonical(result)===canonical(event);
 return {eventVersion:2 as const,eventId:event.eventId,eventType:event.kind,sessionId:event.sessionId,
  actorRole:verified?event.snapshot.state.roleId:null,payload:event,
  previousVersion:verified?command!.expectedStateVersion:null,newVersion:event.stateVersion,
  timestamp:event.timestamp,idempotencyKey:verified?command!.idempotencyKey:null,
  provenance:verified?'verified-command-v1' as const:'unattributed' as const};
}
