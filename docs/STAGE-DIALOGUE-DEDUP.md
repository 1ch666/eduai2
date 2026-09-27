# Stage dialogue durable admission — 2026-09-28

Scope: legacy POST `/api/court/sessions/:id/dialogue`. The request still returns
the existing `{text,mode,speaker,version}` shape. No frontend or Unity change.

## Contract and implementation

- Worker retains session, Origin, CSRF, general court rate limit and per-user
  dialogue rate limit. A cached result does not consume the AI rate allowance.
- `CourtRoom.stageDialogue(owner, version, allowAI)` checks ownership, integral
  version, current state and cached result. Only the trusted Worker supplies the
  admission flag; the public request cannot enable AI or choose a provider.
- Before provider I/O it inserts one durable attempt per state version. Another
  request returns 409 while pending. The 20-second recovery deadline exceeds the
  adapter's 15-second timeout. No polling loop, queue or automatic retry is added.
- After interruption, a subsequent request at/after the deadline seals the
  existing scripted turn. Late results cannot replace it. Even without recovery,
  a completion after the deadline selects the scripted turn, not late AI text.
- Owner/deletion/version are rechecked at save time. A changed version returns
  409; a deleted session returns 404. No stage, score, truth or event is mutated
  by this presentation-only operation. Model context remains the public view.
- Missing key, disabled AI, rate denial or provider failure preserve scripted
  fallback. Success retains `ai-dialogue`; no failure is mislabeled as AI.

## Migration, compatibility and rollback

Schema addition v1 for this feature: `court_dialogue_attempts(version INTEGER
PRIMARY KEY, created INTEGER NOT NULL)`, created with IF NOT EXISTS in the
existing CourtRoom constructor. No existing table/column is rewritten, no new
DO class or binding, no Wrangler class migration. Existing cached dialogue is
read before reservation, so old results survive unchanged. Records contain no
prompt or private dialogue. They are bounded by the room's existing version/
action limits and removed with all other case content by owner-authorized delete.
The minimal deletion guard still prevents delayed resurrection.

Dry run: construct a pre-feature in-memory SQLite fixture with state, journal
and cached dialogue, then instantiate the current class and verify equivalence.
This is not a production restore or full Cloudflare migration test.

Rollback: restore the previous Worker code while leaving the additive table in
place; do NOT drop/reset production data. Old code can read the unchanged state
and dialogue tables but does not enforce the new reservation. Prefer a forward
fix; if rollback is necessary, disable stage AI through the existing operator
control to avoid duplicate inference. Old deletion code does not clear this new
metadata table; apply the current cleanup again after forward recovery. Existing
private graph privacy requires never rolling back before public projection fix
1fd7013. Prior runtime version: 84455261-9668-49a6-a963-331457defd3f.

## Evidence and remaining limits

`node --test scripts/test-court-journal.mjs scripts/test-stage-dialogue.mjs`:
42 tests passed, including seven new groups: concurrent tabs/cache, restart and
expiry with late response, late completion without recovery, state-change/delete,
ownership/input rejection, disabled/failing provider and additive migration.
Real Node SQLite and actual domain code, mocked DO lifecycle/provider, no sleeps
to manufacture ordering. Does not claim workerd scheduling proof.

`scripts/check-court-v1-api.mjs` adds actual local workerd HTTP/RPC coverage for
fallback concurrency, auth/CSRF/owner checks, version/event preservation and
deletion. It is local-only and requires AI disabled/no key. CI/deployment results
will be recorded after execution, not inferred from source code.

This is per-version request deduplication, NOT global concurrency/cost governance.
Concurrent calls for distinct versions/rooms still require broader admission
control, bounded queue, budget and circuit infrastructure under the full goal.
No semantic model-quality, production inference or authenticated production
mutation is claimed.

## Published verification

Runtime source `894528615ac2fcf63935b4393836df6f29172faf` (implementation
`a4a933b`, fixture quota correction `8945286`) pushed to origin/main. Local fast
gate: 243 tests, typecheck, frontend checks and unchanged Unity artifact contract
passed. CI https://github.com/1ch666/eduai2/actions/runs/36343636660 passed both
fast and disposable local workerd integration jobs. Earlier run 36343567913
passed new stage dialogue checks but failed the later NPC fixture signup with
429; reusing an existing fixture fixed this without relaxing production limits.

Wrangler dry-run succeeded; strict deploy with --keep-vars succeeded as Worker
`e37d0a79-a856-4378-a40c-bb1ac466e2d4`. No updated static assets. Public production
capabilities/court-cases returned 200 with request IDs; anonymous sessions and
stage-dialogue POST returned 401. These are liveness/auth probes, not proof of
authenticated production dedup, model quality or existing-room migration under
load. No production account/session creation, AI call or data reset was used.
