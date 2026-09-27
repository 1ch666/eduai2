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

- Add machine-readable persisted-state schema and restore validation.
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
