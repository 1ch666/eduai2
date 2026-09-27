# Internal court snapshot journal — candidate, not deployed

This is server-only historical state persistence, not a browser replay payload,
research dataset or disaster recovery archive. Owner IDs, generated answer keys
and private graphs must never cross a public API, Unity bridge or telemetry sink.
There is deliberately no export/restore HTTP endpoint or new DO RPC method.

## Storage contract v1

`contracts/court-private-journal-v1.schema.json` describes SQL row interchange;
its body strings are JSON, not proof that arbitrary imported CourtState is valid.
`court_replay_meta` records schema_version=1. Unknown versions fail closed.
`court_replay_context` deduplicates canonical JSON containing id, owner, config,
createdAt, ruleVersion and optional generatedCase/generationVersion/privateGraph.
`court_replay_state` stores each event's version, event_id, context_id and the
remaining mutable state as canonical JSON. Large immutable case data is not
copied for every action. Mutable statements are snapshots, not compressed deltas.

All existing journalled transitions call appendPrivateState inside the same
transaction as public event/live state/request outcome. Legacy checkpoint reads
now use an explicit transaction for both journals. Read-only v2 events remain
SELECT-only and never create private history. Deleting a session deletes both
private tables' contents; schema metadata contains no session content.

reconstructPrivateState(sql, version) reads exactly the recorded snapshot,
checks event/context links, rejects overlapping/prototype keys, and returns null
for missing history. It never advances the live state or calls a model. This is
snapshot reconstruction, not independent validation by replaying commands, and
not a full validator for untrusted imported states. Do not expose it to clients.

## Additive migration and rollback plan

Initialization creates three new tables only, with an explicit local schema
version, under existing DO constructor initialization. No Wrangler binding/class
migration, old table rewrite, automatic backfill or invented historical data.
An old session starts recording at its next journalled version/checkpoint; an
existing public event does not imply a corresponding private snapshot exists.
No forced recreation of sessions or clearing production data is permitted.

Old runtime code can read the unchanged live/public tables. A persistent SQLite
trigger `court_replay_erase_on_state_delete_v1` now erases both private tables when
the singleton live state is deleted, including by the pre-feature a68df68 table
deletion sequence. It shares the old deletion transaction and rolls back on
failure. This requires preserving the trigger and its tables during rollback;
do not drop them or substitute a different destructive schema operation.
Node SQLite validates the old DELETE sequence; the local workerd fixture also
checks actual runtime trigger execution, reconstruction and rollback atomicity.
Its SQL introspection subclass is test-only and absent from production exports.
Returning to the new code does not silently fill gaps produced by older code.

## Verification and remaining release gates

Node SQLite tests cover exact version-0/action/NPC state reconstruction, one
context reused across versions, SELECT-only reads, deletion, transaction failure,
old-schema recreation preserving state and missing-link rejection. Existing
public graph leakage tests remain in place. This is not production restore proof.

Before deployment: fast CI, actual workerd compatibility, migration dry-run and
recorded rollback deletion drill results. Before backup/restore claims: complete state/import
validation, protected operator export of ALL required tables (including outcomes,
pending reservations and deletion guards), archive integrity/encryption, isolated
restore and cross-table verification. Accounts/progress/experiment backup remains
separate unfinished work. No production migration or deployment has occurred for
this candidate.
