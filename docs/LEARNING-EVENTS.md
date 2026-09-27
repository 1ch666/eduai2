# Learning event infrastructure v1

Status: deterministic contract/validation/retention reducer and internal SQLite
adapter implemented; production collection disabled and not wired to any route or
production database. This is not a new
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

Current retention has a transactional alarm scheduler, but no deployed collector.
Before collecting: integrate a dedicated DO host, expiry alarms even when
idle, opt-out/withdrawal erasure, bounded export, access controls, and backup/log
retention. Disabling the reducer does not erase existing persisted data; there is
currently no production store. Never advertise guaranteed expiry until the host and
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

Next: versioned producer definitions, consent/scoping approval, deployed host with
real alarm/expiry/withdrawal tests, then opt-in endpoint integration and production
verification. Do not backfill real users' histories or enable collection as part of
routine deployment without completing these boundaries.

## Internal SQLite adapter (not deployed)

`src/learning-event-store.ts` accepts a trusted per-scope SQL storage and synchronous
transaction API. Two additive tables: learning_meta(id=1, schema_version=1,
anonymous_id, withdrawn=0/1) and learning_state(id=1, body=canonical v1 state).
Metadata is an identity/version binding, not proof of consent. There is no global
shared store or account mapping. Caller supplies verified consent for each append;
default false. Initialization alone collects no events and never resets unknown
schema, foreign scope or corrupt existing records. Serialized state is capped at
1 MiB in addition to reducer event/retention bounds.

Append/read/reduce/write happen inside one transaction without await. Returned
values contain only status and nextExpiry, not event data. Restart reads persistent
state; retries cannot count again. Pruning returns the next absolute expiry, but
the adapter DOES NOT schedule an alarm. The eventual DO host must persist/schedule
expiry reliably and test crash recovery before collection is enabled.

Withdrawal deletes learning_state and marks metadata withdrawn in the same
transaction. This minimal scope tombstone prevents late requests and initialization
from resurrecting events. A later opt-in needs a newly issued scope, not resetting
this one. Correct-scope withdrawal can erase malformed event bodies without parsing
them; unknown metadata versions or mismatched scope still fail. This is logical
database erasure, not a claim that provider backups or storage pages are securely
wiped. Backup-retention and tombstone retention policies need separate review.

`scripts/test-learning-event-store.mjs` uses real in-memory Node SQLite with a
test transaction adapter: restart, default-off, duplicates/conflicts, expiry,
commit failure, withdrawal failure rollback, permanent revocation, corrupt body
erasure and schema/scope isolation. These are not workerd/alarm/production tests.
No production constructor imports this adapter; no tables were created in production.
Future integration requires an additive migration and rollback plan that preserves
withdrawal guards. Never install this into a shared database with unrelated scopes.

## Transactional alarm scheduler (not deployed)

`src/learning-event-scheduler.ts` wraps the existing store in an asynchronous
SQLite storage transaction. SQL changes and setAlarm/deleteAlarm commit together;
failure rolls back both. Earliest retained event determines the next wakeup.
Default-off requests still maintain an existing expiry alarm. Alarm handling prunes
without needing a new user request, is idempotent, and propagates storage failures.
Withdrawal cancels the alarm atomically with erasure and the durable tombstone.
Explicit initialization repairs scheduling and prunes overdue rows after recovery.
There is no per-request blockConcurrencyWhile or external I/O in the transaction.

This is an internal scheduler, not a new production DO binding or public endpoint.
The enclosing DO must implement alarm(), supply trusted scope/catalog/time, own
its single alarm exclusively, and arrange authenticated consent. Do not schedule
from its constructor ahead of an already pending alarm. Never mount it in a
shared production CourtRoom; only the local test subclass uses CourtRoom to reuse
the isolated fixture. No production exports or configuration changed.

2026-09-28 local evidence: 10 focused tests, TypeScript, full fast gate (358 tests),
and `check-admission-runtime.mjs` against local workerd passed. Node SQLite covers
restart, earliest expiry, duplicate ticks, failed append/prune/withdrawal scheduling
and late requests. Actual workerd confirms SQL+alarm rollback after an injected
failure, explicit-clock expiry and withdrawal. This drill calls expiry directly:
it does NOT prove wall-clock alarm delivery, automatic retry or eviction wakeup.
Those, durable catalog bootstrapping, operational monitoring after exhausted
retries, consent/producer integration and production verification remain required.

Platform references checked before implementation:
https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
https://developers.cloudflare.com/durable-objects/api/alarms/
Finite platform retries do not guarantee deletion during an indefinite outage;
do not promise exact-time erasure or backup removal from these tests.
