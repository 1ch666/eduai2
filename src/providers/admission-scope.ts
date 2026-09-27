import type {AdmissionScope} from './admitted';

export interface PersistedAiAttempt {
  kind:'stage-dialogue'|'npc'|'case-generation'|'tutor'|'photo';
  owner:string;
  sessionId:string;
  requestKey:string;
  /** Original server timestamp from the domain reservation, never retry time. */
  issuedAt:number;
}
const hash=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('');

/** Domain-separated pseudonyms, not encryption/anonymization of low-entropy IDs.
 * No raw identity in the admission ledger; never log these keys publicly.
 */
export async function admissionScope(attempt:PersistedAiAttempt):Promise<AdmissionScope>{
  if(!attempt||!['stage-dialogue','npc','case-generation','tutor','photo'].includes(attempt.kind)||
    !Number.isSafeInteger(attempt.issuedAt)||attempt.issuedAt<0||attempt.issuedAt>8e15||
    ![attempt.owner,attempt.sessionId,attempt.requestKey].every(s=>typeof s==='string'&&s.length>0&&s.length<=128))
    throw Error('Invalid persisted AI attempt');
  // Snapshot before async hashing so mutation of a caller object cannot split
  // the issuance date, owner and nonce into unrelated identities.
  const {kind,owner,sessionId,requestKey,issuedAt}=attempt;
  const [nonce,userKey,sessionKey]=await Promise.all([
    hash(['ai-attempt-v1',kind,owner,sessionId,requestKey]),
    hash(['ai-user-v1',owner]),hash(['ai-session-v1',owner,sessionId])
  ]);
  return {id:Math.floor(issuedAt/86400000)+':'+nonce,userKey,sessionKey};
}
