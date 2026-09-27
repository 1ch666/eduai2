# Learning event infrastructure v1

Status: deterministic contract/validation/retention reducer implemented, production
collection disabled and not wired to any route or database. This is not a new
grading system, a research study or proof of learner ability.

Contract: `contracts/learning-events-v1.schema.json`; implementation:
`src/learning-events.ts`. No schema migration or API compatibility change yet.

Each record contains only schema/event versions, event UUID, scoped anonymous UUID,
server timestamp (epoch milliseconds), allowlisted kind/concept and bounded numeric
value/sampleSize. No open text, question, answer, dialogue, age, account ID, cookie,
IP address or device identifier. Unknown/extra fields are rejected, not silently
retained. Non-completion concepts must match the server's trusted concept catalog.
Completion has a null concept. Unknown versions and corrupt state fail closed;
the caller must not replace them with an empty store.

## Measurement meaning

| kind | value / sampleSize |
| --- | --- |
| concept_mastery | Correct first attempts / valid first attempts |
| repeated_error | Repeated errors under a versioned producer definition / eligible attempts |
| evidence_reasoning_error | Objectively classified evidence errors / eligible decisions |
| procedure_error | Rejected procedural decisions / eligible decisions |
| hint_dependency | Hint-assisted attempts / eligible attempts |
| completion | Completed activities / started activities |

The reducer only verifies 0 <= value <= sampleSize <= 1000 and valid references;
it cannot establish how counts were measured. Producers must document their exact
criteria and source versions. AI free-text judgments must not become objective
measurements or competitive scores. Analytics never advances court state or grades.

## Deduplication and retention

Host supplies trusted consent (`enabled` must be exactly true), scoped identity,
concept catalog and explicit time. No clock, randomness, model call or network is
read by the reducer. Its returned state is detached from input.

Within each scope at most 1,000 events are retained for 30 days from occurredAt.
Same event UUID and identical contents are duplicate/no-op; changed contents conflict.
Full stores reject new events instead of evicting live deduplication records.
New events more than 24 hours old or in the future are rejected. Thus an expired
event cannot be replayed after its deduplication entry is pruned. A backward host
clock is rejected; state is not silently reset. A null event is an explicit pruning
tick. Invalid incoming events can still return a pruned state; the host must persist
that maintenance atomically, while reporting the rejection.

Current retention is a PURE REDUCER POLICY, not a deployed deletion scheduler.
Before collecting: implement transactional persistence, expiry alarms even when
idle, opt-out/withdrawal erasure, bounded export, access controls, and backup/log
retention. Disabling the reducer does not erase existing persisted data; there is
currently no persisted store. Never advertise guaranteed expiry until the host and
its restore/backup behavior have been verified.

## Anonymous identity boundary

The host must issue an independent random, study-scoped identifier, not reuse an
account UUID, court ID, session token or deterministic hash of a person. A matching
UUID format cannot prove anonymity. If anyone retains a linking table, treat the
data as pseudonymous; aggregation/reidentification risks still need review.
The reducer checks the trusted expected scope but is not an authorization endpoint.
Never accept a client-provided scope or consent flag as trusted. No production
identity linkage or event collection was added by this change.

## Tests and next steps

`node --test scripts/test-learning-events.mjs` verifies all six event kinds,
schema parity, detached deterministic output, default-off behavior, duplicates,
conflicts, full capacity, expiry/replay after pruning, 120 simulated days, clock
rollback, foreign identities, unknown concepts, private extra fields, accessors,
sparse arrays, corrupt state and unsupported versions. Fast CI includes this suite.

Next: versioned producer definitions, consent/scoping approval, durable host with
transaction/expiry/withdrawal tests, then opt-in endpoint integration and production
verification. Do not backfill real users' histories or enable collection as part of
routine deployment without completing these boundaries.
