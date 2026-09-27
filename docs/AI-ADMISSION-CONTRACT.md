# AI admission v1 — deterministic core (not enabled in production)

`src/providers/admission.ts` supplies a pure typed state/command/result contract
and reducer, separate from model semantics and provider HTTP. This is the first
layer of the goal's global backpressure/cost infrastructure, not a claim that
current endpoints are already globally governed.

## Atomic host contract

1. Resolve authenticated identity/operation on the server. Use pseudonymous
   user/session keys and a canonical request fingerprint, never prompts/secrets.
2. Restore a validated version-1 state, choose server time and trusted policy.
3. Apply `admit`, `poll`, `cancel`, `finish` or `tick` in a transaction.
4. Persist the returned state before performing any `start` effect. Never reissue
   an effect from an EXISTING result, even if a response was lost.
5. Call the bounded provider once. Abort on caller cancellation/deadline, then
   settle once. Missing/late completion remains unknown; never refund/retry it.
6. Endpoint-specific existing scripted fallbacks remain available on denial.

Admission reserves one attempt from global UTC-day, user/day and user+session/day
budgets, including queued requests. Queued cancellation/expiry refunds because no
effect was issued. Started requests consume an attempt even on failure or unknown
result. Tokens are accounting observations, nullable when unreported, not billing
prices. Monetary budget enforcement remains a later accounting integration.

FIFO is insertion order; polling cannot jump the queue. Queued work is cancelled
at its deadline, global disable or UTC-day change (not silently charged to a new
day). A lease expires to unknown. Consecutive failures open a circuit; quota opens
it immediately. After cooldown only one probe is admitted; its success closes
the circuit. Success from earlier parallel work cannot erase an active cooldown.
Disabled admission never starts a queued job; cancelling active work cannot undo
provider usage. The host must actually propagate cancellation to the provider.

The records cap fails closed. Explicit pruning removes only settled old records;
the host MUST validate signed/server-issued request age before pruning, otherwise
an old ID could be replayed as new. No automatic pruning is currently enabled.
Policy, restored-state schema validation, runtime storage transactions, provider
credential-scope routing, key lifetime and request ownership belong to the host.
The reducer is internal, not safe to expose as an unvalidated public RPC.

## Integration/migration plan (still required)

- Shape schema: `contracts/ai-admission-v1-state.schema.json`; restore validator:
  `src/providers/admission-state.ts` (implemented, host integration still required).
- Add a narrow provider-credential admission coordinator; do not route all app
  state or inference content through one global application object.
- Durable atomically persisted reservations, schema version and bounded retention;
  additive migration, local workerd races, crash/restart and restore tests.
- Govern tutor, photo, generation, stage dialogue and both NPC versions through a
  common provider wrapper. Preserve their distinct existing fallback contracts.
- Set explicit free-tier limits only after operator capacity validation; no new
  paid service, plan upgrade, Secret or provider replacement.
- Expose truthful availability plus structured usage metrics without ledger keys,
  private text or raw tokens. Verify deployment and rollback before enabling.

Current change adds no binding/database table/API, changes no deployed route and
does not enforce a production global cap. Safe rollback is removal of the unused
module/tests/docs. Do not claim the budget/circuit/availability goal complete until
the integration and production verification above actually pass.

## Deterministic verification

`node --test scripts/test-ai-admission.mjs`: 11 groups pass, including FIFO and
duplicate/conflict, running cancellation lease retention, all three budget scopes,
UTC rollover, unknown outcomes, kill switch, one half-open probe, circuit-epoch
fencing, nullable usage, record cap, malformed policy/command/time and pruning.
3,000 seeded commands compare the complete reducer output from the same prior
state, assert no ID receives two grants, and check queue/concurrency/budget caps.
These are pure-function tests, not storage concurrency, live provider or production
evidence. No timing sleeps or provider calls. TypeScript typecheck passes.

## Persisted-state boundary

`parseAdmissionState(unknown)` accepts only exact data-property shapes and copies
validated values. It enforces version 1, unique request IDs, insertion chronology,
day/creation consistency, bounded deadlines and circuit generations, active queue/
lease limits and phase/outcome/usage relationships. Machine schema validates JSON
shape; cross-field checks remain mandatory in the runtime validator. Unknown or
corrupt existing state returns null: the host must fail closed, NOT call
emptyAdmission and overwrite the record. Missing storage on a genuinely new
coordinator is distinct from invalid existing data.

The input is already parsed data. A future host must bound serialized bytes before
JSON parsing; the 100,000-record absolute schema cap is not a recommended free-tier
policy or permission to buffer arbitrary input. No public import endpoint exists.
No getter/iterator execution, unknown fields, inherited data or sparse arrays are
accepted. The validator does not prove authenticated ownership or historical
integrity; those are host/storage responsibilities.

Verification: 16 combined groups (admission/state), 512 seeded shape mutations
compared with Ajv plus runtime cross-field checks, and all 3,000 reducer states
round-trip through restore validation. Tests cover late/unknown usage remaining
null, non-mutating restore, duplicate IDs and future/invalid versions. No storage
migration or production deployment is implied by these tests.

## Durable coordinator candidate

`admission-store.ts` atomically loads/validates/reduces/writes the ledger before
returning a start receipt. Two additive tables (`ai_admission_meta` v1 and
`ai_admission_state`) distinguish a brand-new store from missing/corrupt state.
Initialization does not replace invalid data. Serialized reads/writes are bounded
to 1 MiB. A storage exception returns no grant; unknown results keep the original
reservation. Every poll/cancel/finish matches ID, fingerprint, user and session;
conflicts disclose neither phase nor ledger. Receipts omit all ledger records.

`admission-coordinator.ts` is the actual DurableObject class with server time,
disabled-by-default admission and synchronous storage transactions; no provider
I/O occurs while holding the transaction. It is NOT exported by the production
entry point, bound in production Wrangler config or consumed by live endpoints.
The candidate conservative policy is not an assertion about available free quota.
No automatic pruning yet: reaching the record/byte cap fails closed. Request-age
validation and safe retention are still required before rollout.

Migration: new isolated SQLite class only when integration is ready; never reuse
or clear account/court databases. In local tests new tables initialize together,
metadata versions other than 1 and missing state reject. Rollback before runtime
activation removes unused code only; after binding, retain class/migration and
stored budgets while disabling admission. Do not delete/recreate the namespace.

Seven actual Node SQLite tests cover commit/rollback, restart/lost response,
identity fencing, corrupt/oversized/missing state, metadata mismatch and the
actual class under concurrent calls. Lifecycle is mocked there. A separate local
workerd fixture and CI step exercise real RPC/SQLite concurrency and receipt
projection. `scripts/fixtures/admission-wrangler.jsonc` and its unauthenticated
dispatcher are local test harnesses ONLY: never deploy them or route traffic to
them. The runtime checker rejects non-loopback targets. CI evidence is recorded
after execution; not inferred from the presence of a harness.

Verified source `c6790a4910753e66d08c38bdd2b4e8c4eea69ddc`: CI
https://github.com/1ch666/eduai2/actions/runs/36344848597 passed fast checks,
existing local API suites and the isolated workerd admission RPC step. This adds
real runtime evidence for dedup/FIFO/identity fencing/receipt projection. The
process-restart and failure-injection evidence remains the separate SQLite suite,
not a claim of production recovery or live-provider integration. No production
deployment or new binding was performed for this candidate.

## Retention and request-age boundary (latest candidate)

The durable host now requires request IDs in `<UTC issuance day>:<stable nonce>`
form (canonical unsigned day, 1–90 alphanumeric/underscore/hyphen nonce). The
trusted server issues and preserves this identity across retries; NEVER take the
day from a public request or prepend today's date afresh on each retry. The
coordinator remains a private binding candidate, not an authenticated HTTP API.
This is an internal caller contract change before any production adoption.

Only today/yesterday's issued IDs can enter the ledger. Older/future IDs receive
STALE without a grant. Valid operations first expire leases/queued work, then
prune settled records older than yesterday and commit the next decision in the
same SQLite transaction. Current-day budgets and yesterday's retry identities
remain. Cleanup is lazy on traffic, not a claim of automatic erasure by a strict
wall-clock deadline. No cleanup alarm is installed yet. Stored schema stays v1;
there is no new class migration. Older candidate metadata/records stay readable,
but undated old IDs cannot be newly submitted to this host.

Ten SQLite groups pass, including 30 simulated days, retained duplicate refusal,
replay after pruning, future/malformed IDs, stable yesterday IDs and write-failure
rollback of cleanup plus admission. The real workerd fixture now issues dated IDs.
No account, court, progress or production data is deleted. Rollback must not
reactivate the prior age-unchecked host against a ledger already pruned: disable
admission or forward-fix it, otherwise removed IDs could be re-admitted. No
production host has yet been enabled. Provider wrapper/endpoint adoption still
must preserve the original issuance ID and be verified before rollout.

## Provider wrapper candidate (2026-09-28)

`providers/admitted.ts` implements LLMProvider v1 over the private admission RPC
port. The trusted caller supplies a stable dated scope; the wrapper snapshots the
bounded input and hashes provider/model/input/response cap into its fingerprint.
No prompt, response, raw account token or key enters the admission ledger. Only
a newly committed ACCEPTED/running/start grant with a live lease runs inference.
EXISTING never takes over another caller's queued/running request. The domain
still owns authorization, original issuance identity and cached result recovery.

RPC waits are bounded to one second, queue polling to twenty polls/five seconds;
both consume the caller timeout. Inference receives the smaller remaining caller
and lease budget, with a 50ms lease guard. No inference or ambiguous RPC retries.
Lost admit receipts never start inference. Lost poll receipts cancel only this
caller's known reservation; a started lease becomes unknown, not refunded.
Cancellation/network/timeout after inference keep the charged slot until expiry.
Definite quota/failure settles the circuit; successful usage remains nullable.
Cleanup/settlement is awaited and bounded to an additional one second. If final
settlement is lost, a valid answer is returned but the ledger remains conservatively
charged/unknown on expiry. No successful accounting acknowledgement is claimed.

Provider contract adds ADMISSION_DENIED / ADMISSION_UNAVAILABLE (not vendor quota).
Tutor has explicit compatibility messages/status mapping; existing providers and
routes otherwise remain unchanged. Twelve Node test groups include gated races,
real reducer dedup, immutable payload fingerprint, lost receipts, cancellation,
quota, lease bounds and a provider ignoring abort. The isolated workerd fixture
also composes the wrapper with actual SQLite DO RPC and a synthetic no-network
provider; its CI checker asserts one inference for eight duplicates and zero
inference after quota opens the circuit. Runtime verification is recorded after
the corresponding CI run, not implied by the fixture's existence. Local run on
2026-09-28 with Wrangler 4.136.3 at 127.0.0.1:8798 passed both RPC and wrapper
checks (separate outputs/admitted-provider-state, no production credentials or
inference). `node scripts/ci-fast.mjs` passed 281 tests, typecheck, frontend and
unchanged Unity artifact contract; remote CI is verified after push.

Not yet production-bound or adopted by tutor/photo/NPC/generation/stage endpoints.
Next: preserve each domain's original persisted issuance identity, bind one global
coordinator, verify fallback compatibility across all endpoints, additive deploy
and production probes. No new DB migration, deployment or production data changes
in this wrapper batch. Do not label global governance complete from unit tests.

## First handler adoption candidate

The next batch wires `CourtRoom.stageDialogue` to the governed provider using its
persisted reservation timestamp/version, adds the AI_ADMISSION binding/class
(additive migration v9), and leaves other routes unchanged. This supersedes the
earlier "no production binding in source" statement, not the rollout status.
See [AI-ADMISSION-ROLLOUT.md](AI-ADMISSION-ROLLOUT.md) for limits, compatibility,
rollback, verification and the still-unmigrated NPC/generation/tutor/photo routes.
