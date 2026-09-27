# Replay foundation — 2026-09-27

## Implemented, not deployed

Each CourtRoom now has an additive `court_events(version PRIMARY KEY,event_id UNIQUE,body)` table. New session creation, successful actions and NPC reply commits append a public snapshot/event inside the same transaction as state and result-cache writes. Repeated requests return the existing result without another event. A failed event write rolls the transaction back.

`GET /api/court/sessions/{id}/events?after=-1` is an authenticated owner-only read, ordered by version, at most 20 events per page; use `nextAfter` for the next page. Reading history does not rerun transitions or AI. A legacy session without history starts with a clearly labeled checkpoint at its observed current version. Earlier events are not reconstructed from statements or caches.

Snapshots explicitly select public fields; no owner, generatedCase object, answer key, prompt, private reasoning or NPC knowledge IDs are serialized. Current template evidence is public; this is NOT yet a role-private evidence system. `npcs` is deliberately empty until the full server role/seat mapping exists. Evidence is currently document projection, not all nine visual presenters. Do not enable the new game client based on this journal alone.

## Important limits

- v0 stage dialogue cache is not yet recorded as a versioned event. Player NPC question and response need a richer transcript contract; current NPC event records the response only. This is not a complete transcript.
- No timeline UI, scrubbing, playback scheduler, research overlay or replay Unity presenter exists yet.
- v1 mutations and recorded outcome lookup now exist in source, using additive court_v1_requests with unique request/idempotency keys. State, event and outcome commit together; exact retries return the original event. Existing v0 request caching is unchanged. Rejected outcomes are not yet persisted for reload discovery.
- Current schema/limits must be reviewed before production deployment. No destructive migration, new DO binding, secret or account change is required. Existing tables and data remain. Deploying this source would create the additive table; do not describe it as no database change.
- Rolling back to an older Worker can leave recording gaps. Resuming journaling creates a checkpoint rather than inventing the intervening events. Clients must display these gaps.

## Verification

`node --test scripts/test-court-journal.mjs`: 9 tests using actual in-memory Node SQLite transactions, with a mocked DurableObject base/lifecycle. Covers ordering, request deduplication, rollback on event/outcome write failure, wrong owner, checkpoints, NPC fallback, pagination, v1 civil-judge completion and response-loss recovery. TypeScript passes.

`node scripts/check-court-v1-api.mjs http://127.0.0.1:8792`: passed on real local workerd with isolated local persistence, disposable accounts and AI disabled. Covers HTTP authentication, CSRF, owner isolation, raw duplicate field rejection, stable result retrieval and one-event-per-operation. This does not prove full courtroom E2E, browser, production or real-device behavior. All seven final E2E scenarios remain required.
