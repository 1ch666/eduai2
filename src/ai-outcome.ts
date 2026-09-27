/** Describes only content actually delivered, never future eligibility or
 * platform-wide health. modelUsed does not say whether a failed attempt spent
 * quota. An exact dictionary lookup is not a RAG pipeline.
 */
export type AiFeature = 'tutor' | 'photo' | 'npc' | 'stage-dialogue' | 'case-generation';
export type AiSource = 'model' | 'retrieval' | 'scripted' | 'dictionary' | 'none';
export interface AiOutcome {
  schemaVersion: 1;
  scope: 'response';
  feature: AiFeature;
  mode: 'FULL' | 'RAG_ONLY' | 'SCRIPTED_AI_FALLBACK' | 'NO_AI';
  source: AiSource;
  modelUsed: boolean;
}
/** Server-internal composition only. Never pass source from client/model JSON.
 * retrieval is reserved for a verified retrieval-only adapter; current exact
 * dictionary lookups must use dictionary, not retrieval.
 */
export function aiOutcome(feature: AiFeature, source: AiSource): AiOutcome {
  return {schemaVersion: 1, scope: 'response', feature, source,
    mode: source === 'model' ? 'FULL' : source === 'retrieval' ? 'RAG_ONLY' :
      source === 'scripted' ? 'SCRIPTED_AI_FALLBACK' : 'NO_AI',
    modelUsed: source === 'model'};
}
