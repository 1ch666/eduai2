# Response-level AI outcome contract v1

Goal section 16 increment; not completion of the whole degraded-mode gate.

`contracts/ai-outcome-v1.schema.json` and `src/ai-outcome.ts` define the additive
`aiOutcome` field. Scope is **one delivered response**, never platform health,
future capacity, legal correctness or model intelligence.

| Mode | Source | Meaning |
| --- | --- | --- |
| FULL | model | A model result passed the existing feature output checks and supplied this response |
| RAG_ONLY | retrieval | Reserved for a verified retrieval-only implementation; no current route emits this |
| SCRIPTED_AI_FALLBACK | scripted | Actual predefined teaching/status text is delivered, not a model answer |
| NO_AI | dictionary / none | Exact dictionary text, or no answer delivered |

`modelUsed` means model output was used in the delivered content. False does not
mean no upstream attempt occurred, no tokens were charged, or retry is safe.
Failures and unknown outcomes retain the existing admission/dedup protections.
An exact MOE lookup must never be promoted to RAG_ONLY merely because it retrieved
a dictionary entry. Future RAG integration must supply validated public citations
and registry versions through its own contract before using the retrieval source.

## Actual integration

- Tutor `/api/ai/ask`: generated answer FULL; exact dictionary NO_AI/dictionary;
  input/rate/config/reservation/provider failures NO_AI/none. Existing errors,
  HTTP statuses, answer/provider/model fields and prompt behavior remain intact.
- Photo `/api/photo/explain`: model explanation FULL; guards and failures NO_AI.
  This still processes confirmed text, not OCR/vision, and claims neither.
- `npcResponse`: validated dialogue FULL; predefined unavailable message
  SCRIPTED_AI_FALLBACK; exact dictionary NO_AI/dictionary. New legacy NPC replies
  persist the field with their existing JSON result. Existing records may lack it;
  absence means unknown historical metadata, never infer a new successful call.
- NPC v1 snapshot/event projection still uses its existing mode DTO and does not
  yet expose this field. Stage dialogue and case generation also remain to adopt
  the contract. Do not claim full platform coverage.
- Capability/status GETs retain **account admission eligibility**, not outcome.
  READY can coexist with failed inference; there is no synthetic health probe or
  fabricated healthy status. Provider-health freshness remains separate work.

## Compatibility, migration and rollback

Additive JSON only; no SQL/schema/Worker bindings/migrations/Secrets changes.
Legacy clients ignore the new field and continue using their original fields.
Old persisted NPC JSON is left untouched. Rollback to source 9353127 (Worker
0a3e5819-3c92-4358-b2d3-642353321633) ignores the additive field without deleting
data or removing the existing admission safeguards. Never migrate by clearing DOs.

## Verification

Schema tests cover all feature/source pairs and reject contradictory FULL,
fake health, dictionary-as-RAG, unknown versions and private extras. Actual tutor,
photo and NPC handlers exercise success, rejected output, provider failures,
authorization/input failures, duplicate attempts and dictionary bypass with fake
providers only. No new live model call is required to test these mappings.

Production verification after release: public GET status remains compatible;
invalid tutor request and anonymous photo request must return their old error
statuses plus NO_AI/none, without sending data to a model. Authenticated NPC and
live model success require separate evidence and must not be inferred from these
probes.

Local evidence: 310 fast-gate tests passed, TypeScript/frontend and existing
Unity artifact checks passed; Wrangler dry-run exit 0, 454.85 KiB / gzip
104.33 KiB. These are not live model/semantic or mobile test results.

## Released evidence — 2026-09-28

- Source `78cd1e27ecce570354bb8f3c494b16d5d234eecc`, pushed to main.
- CI `36349627787`: checks and real local-api/workerd jobs succeeded.
- Worker `545772b3-e72f-41e6-afe2-a19526e59693`, deploy exit 0. No assets updated.
- Production invalid `{}` tutor request: 400 + response/tutor/NO_AI/none.
  Anonymous photo explain: 401 + response/photo/NO_AI/none. Both returned server
  request IDs. These probes terminate before inference or data creation.
- Three public capability/status GETs: 200, existing availability compatible,
  READY with providerHealth explicitly not-probed. No live model inference or
  authenticated NPC write was performed; such success is not claimed.
- No migration, permission, Secret, key, payment or Unity changes. Unrelated
  user-owned README work remains uncommitted and untouched.
