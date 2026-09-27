# AI admission: staged rollout and recovery

## Stage dialogue adoption (2026-09-28, candidate until deployment recorded)

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

NPC, case generation, tutor and photo are NOT yet routed through this wrapper.
They retain their existing local rate guards, but can bypass this coordinator's
limits. Therefore this is NOT a completed global kill switch or all-platform
cost cap. Their rollout must preserve the original persisted request identity;
tutor/photo need an issuance/reservation design before adoption. Availability
capability responses are still configuration-based, not live quota health.

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
