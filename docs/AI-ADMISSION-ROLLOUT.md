# AI admission: staged rollout and recovery

## Stage dialogue adoption (2026-09-28)

Released runtime source `208925aab162a5580d2b61b199a49bcc42a2d382` (handler
adoption ac97a84 plus timer fix), CI **36346556730** passed checks/local-api.
Wrangler 4.136.3 dry run and actual `deploy --keep-vars --strict` succeeded;
Worker version **f2ee1d91-51fd-4cd7-97c1-517dccd6a725** at the existing
`https://civic-law-lab-212.yichengc869.workers.dev`. No static assets changed.
Post-deploy read-only probes: capabilities 200, court/cases 200, anonymous
court/sessions 401, each with X-Request-Id. These probes do not execute an
authenticated inference or prove complete cost governance. Previous runtime
e37d0a79-a856-4378-a40c-bb1ac466e2d4 lacks this control; heed rollback below.

The first production handler wired to governed inference is
`CourtRoom.stageDialogue`. Existing `court_dialogue_attempts.created` is persisted
before any hashing/RPC/provider I/O. Its original UTC issuance day, court ID,
owner and version identify the attempt. Hash domains separate identity keys from
the payload fingerprint; different endpoints cannot accidentally share a grant.
Retries use the existing domain cache/reservation and never manufacture a new
issuance date. Midnight during the first async call retains the original day.

`admission-scope.ts` validates and snapshots the internal persisted descriptor.
These SHA256 pseudonyms are not encryption or guaranteed anonymization. Never
publish the ledger or accept a public client's issuance timestamp.
`governed-ollama.ts` selects the single `ollama-account-v1` coordinator (the shared
provider-account budget is the coordination atom; no other platform requests go
through it). Missing binding, failed RPC, denied budget or kill switch selects
the existing scripted turn, without raw-provider bypass. The existing owner,
version, deletion and late-response fences remain unchanged.

## Additive migration and compatibility

- Wrangler migration v9 adds only `AIAdmission` as a new SQLite class and the
  `AI_ADMISSION` binding. v1–v8 classes/bindings remain unchanged; no rename/drop.
- New class initializes its separate version-1 meta/state tables atomically.
  Unknown/corrupt metadata fails closed; no resetting or overwriting a ledger.
- Generated Worker types must include the class/binding. Run `ci-fast.mjs` and
  `wrangler deploy --dry-run --keep-vars` before any actual deployment.
- `AI_ADMISSION_ENABLED=true` grants subject to policy. Any other value disables
  new grants. Preserve dashboard vars on deploy; do not change model secrets.
- Existing court cached replies/state/events need no migration or regeneration.
  No court state or authoritative score changes because of admission.

## Limits and honest remaining scope

Stage dialogue uses concurrency 2, queue 8 (at most 5 seconds), global 100/day,
per-user 20/day, per-court 12/day, 60-second unknown lease and quota/failure
circuit control. Daily windows are UTC. This counts inference attempts, not money
or a guarantee of Ollama's free quota. No billing/paid feature is activated.

NPC and case generation adopted this wrapper in the release recorded below.
The subsequent tutor/photo release 0e7ad2c adds durable reservations and adoption;
see STUDY-AI-ADMISSION.md for its compatibility limits and separate release
evidence (Worker d4bd7403-7914-469c-91d2-3c14a9955098, CI 36348143950).
Availability capability responses are still configuration-based, not live quota
health; full cost accounting and retention gates remain incomplete.

## Rollback / incident procedure

For a new incident, first disable `AI_ADMISSION_ENABLED` to stop adopted model
calls while preserving scripted play and all data. Prefer a forward fix keeping
v9 and the binding/export. Never delete the new class/namespace, clear the ledger,
reset migrations, re-date IDs, switch its account name or retry unknown inference
to make errors disappear. Keep provider credentials and ownership unchanged.
Rolling back to pre-admission code bypasses this control even though domain dedup
remains; it is NOT an equivalent safety rollback. Disable court AI before any
such explicitly approved emergency rollback. Do not roll back to the earlier
age-unchecked coordinator against a pruned ledger.

## Evidence

Focused SQLite tests cover existing cache compatibility, late response, deletion,
concurrent tabs/restart, denied/missing/throwing admission and midnight issuance.
The shared wrapper has independent real workerd + SQLite RPC coverage (commit
9e5ffe6, CI 36345950622). That is not proof of this handler's production rollout.
Record final CI, dry run, deployment version and read-only probes after completion.
Authenticated production inference is not exercised by anonymous health probes.

CI 36346379828 passed local-api but caught timer ordering/classification defects
in the wrapper on Linux. Deployment was withheld. Follow-up replaces competing
sleep/deadline timers with one abortable delay and carries typed timeout causes
instead of guessing from Date.now. The deadline regression now freezes wall time
to assert that a real elapsed timeout is still classified as TIMEOUT. No test
assertions were relaxed to accept the wrong outcome.

## NPC and generation adoption (released 2026-09-28)

Runtime source `b0650e2b97b4ba9b2e067a4234d9cd6af82c16ed`; GitHub CI
36347065503 completed successfully for both `checks` and `local-api`.
Wrangler 4.136.3 deployment with `--keep-vars --strict` exited 0; version
`6f7d3416-efea-4b44-b25c-8176227ad9c0` is deployed to the existing Worker URL.
Upload 446.29 KiB (gzip 102.33 KiB); no static assets changed. No new migration,
Secrets, ownership, billing or permission changes were made.

Post-release read-only probes returned capabilities 200, court/cases 200 and
anonymous court/sessions 401, all with X-Request-Id. These are availability and
anonymous-access checks, not authenticated model calls or proof that the provider
has remaining quota. Local/CI synthetic-provider tests are not live Ollama tests.

Both legacy `CourtRoom.npc` and `npcV1` now pass the original timestamp committed
with their reservation into `npcResponse`. The default NPC composition uses the
same governed provider/account as stage dialogue; absent timestamp or binding
fails closed, not to a raw Ollama adapter. Dictionary lookup and explicit local
AI/rate guards remain before inference. Prewritten failures stay `mode:scripted`
with ADMISSION_DENIED / ADMISSION_UNAVAILABLE; cached outcomes are not reissued.
Stage and NPC use identical hashed user/court budget keys, distinct attempt IDs.

`Learner.generate` receives the owner from the already-authenticated Worker route,
never from request JSON. It commits generation_attempts.created before requesting
the governed provider, and uses a stable per-owner `case-generation` budget scope
(no new court exists yet). Existing 10/day local attempt guard, cooldown, request
dedup, narrative validator, similarity check and randomized library fallback remain.
The internal helper no longer constructs a raw vendor adapter implicitly; it
requires an explicit server-selected provider. Older internal callers without an
owner retain library fallback. Deleting a court does not refund the attempt or
permit its request ID to be reissued.

This batch requires no new migration/config/Secrets changes beyond released v9.
Focused tests cover granted/denied calls, same-account budget identity, concurrent
generation/restart, lost replies, deletion and library recovery. Tutor and photo
remain unadopted, so the kill switch/cap is still NOT all-platform governance.
Rollback to the prior stage-only runtime would bypass NPC/generation admission;
prefer disabling court AI and forward-fixing without clearing any ledger.
Production rollout evidence is recorded above; authenticated production inference
and all-platform governance remain outside that evidence.
