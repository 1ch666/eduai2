# AI account eligibility — schema v1 (2026-09-28)

The `availability` object on `/api/capabilities`, `/api/ai/status` and
`/api/photo/status` now reflects the shared admission coordinator, not merely
the presence of a key. The legacy AI booleans (`available`, `textAi`, `photo`,
and court AI flags) use `canAttempt`; non-AI learning capabilities stay unchanged.
Existing court-specific enable flags are still respected.

Contracts: `contracts/ai-availability-v1.schema.json` (HTTP projection) and
`contracts/ai-admission-status-v1.schema.json` (internal inspection receipt).

`reason`: READY, NOT_CONFIGURED, DISABLED, CIRCUIT_OPEN, BUDGET, QUEUE_FULL,
CAPACITY or UNAVAILABLE. Only READY sets canAttempt=true. That means the
provider-account gate currently allows a new attempt, **not** a reservation,
promise of vendor quota, or proof that a specific user/request will pass its
authentication, user/session/endpoint budget and validation checks.

`providerHealth` is explicitly `not-probed`. This endpoint performs no model call
or paid health check. It must not display READY as “model confirmed working”.
Successful current inference and fresh provider-health observations require
separate evidence. This does **not yet implement** the entire required
FULL/RAG_ONLY/SCRIPTED_AI_FALLBACK/NO_AI feature-level result contract; in
particular, a local dictionary match is not mislabeled as a full RAG service.

## Persistence / privacy / recovery

AIAdmission.inspect uses bounded validated ledger SELECTs only. Virtual expiry
and retention projection do not change stored bytes, spend budgets or issue
grants. The existing DO constructor can initialize a new empty store once;
inspection never resets corrupt/unknown state. No identities, inputs, counts,
tokens, fingerprints or model secrets leave this projection. HTTP composition
has a one-second RPC receipt timeout, fails closed on unknown/missing/corrupt
responses, and does not keep mutable global caches or retry the RPC.

Lease-expiry failure cooldown now starts at the persisted lease deadline, not
the time a later reader discovers expiry. Otherwise repeated read-only status
checks could perpetually project a new cooldown and prevent UI-led recovery.
The real admission reducer and inspection share that rule. Unknown attempts
remain charged and cannot be re-granted; a half-open circuit permits only one
new probe after cooldown, without making this status call that probe.

No schema or configuration migration is needed. Keep existing classes, binding,
Secrets and account unchanged. Old runtime can read these unchanged ledgers,
but rollback loses accurate status and the expiry-cooldown fix. Prefer a forward
fix; never clear the ledger or disable security guards to turn the indicator on.

## Verification / remaining scope

Local tests cover exact private-field-free projections, real Worker routing,
malformed/missing/hung status RPC, late receipts, config shortcuts, budget/queue/
circuit/capacity states, 1,000 seeded comparisons to actual admission decisions,
read-only SQLite bytes and cooldown recovery. The workerd RPC fixture adds READY
and CIRCUIT_OPEN inspection assertions. No production model call is part of it.

Record CI and actual deployment after they finish. Feature-level degraded modes,
user-specific eligibility, provider-health freshness, versioned expiring study
tickets and the broader backend goal are still open. Public account status also
adds read traffic to the coordinator; do not implement rapid background polling.
