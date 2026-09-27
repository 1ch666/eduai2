# Internal court snapshot journal

## Release evidence — 2026-09-28

Source `684bf9dd915f8f40960660d33d1272aca766e241`, CI `36355287105` passed
both fast checks and actual local workerd integration. Wrangler 4.136.3 dry-run
and deploy with `--keep-vars --strict` exited 0. Existing Worker now serves 100%
version `70e01207-a028-460c-a048-f755cf4f9e98`, confirmed by deployments status.
Upload 466.76 KiB / gzip 107.16 KiB, startup 3 ms; no static assets changed.
No binding/class migration, Secret, account, permission or billing change.
The additive tables/trigger initialize lazily on CourtRoom startup; no production
data was cleared, exported, backfilled or manually migrated.

Read-only production probes: capabilities 200, court cases 200, anonymous sessions
401, anonymous v2 events 401 with apiVersion 2 / HTTP_401 and request ID. These
prove baseline availability/auth rejection, NOT authenticated production history
writes or reconstruction. No private SQL inspection or production restore was run.
Authenticated production acceptance remains open; internal reconstruction is not
exposed as a production RPC just to test it.

Rollback target: previous Worker `6df7235c-2523-4af3-a5d6-37e1b1fcce6c`
(a68df68). If reverting runtime, keep the new tables and persisted deletion trigger;
do not reset the database. The legacy deletion sequence was tested locally with
actual workerd. Rollback itself was not executed on production during this release.

Pre-release verification 2026-09-28: base ba0981d passed CI 36353256453. Cleanup trigger
5fa27c3 passed 333 local fast tests; its first workerd drill exposed a test-only
nested JSON key-order comparison bug (delete and rollback already passed).
2d2097e corrects comparison using canonical complete values. The local-api job
of CI 36353531265 passed actual workerd reconstruction, trigger erasure and
transaction rollback; its checks job also passed (full CI success). No production data was
exported or deleted and no model was called in those tests. Deployment is recorded above.

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

reconstructPrivateState(sql, version, expectedIdentity) reads exactly the recorded snapshot,
checks event/context links, rejects overlapping/prototype keys, and returns null
for missing history. It never advances the live state or calls a model. This is
snapshot reconstruction, not independent validation by replaying commands, and
not independent proof that an archive is authentic. Do not expose it to clients.

## Private state validation

`court-private-state-v1.schema.json` describes the full current CourtState shape.
`parsePrivateCourtState` adds trusted expected owner/session binding, supported
RULE_VERSION, canonical timestamps, bounded JSON-only copying, config policy,
generated-template reachability, private graph binding, valid/unique references,
stage/completion/statement/ruling/attempt consistency and minimum version checks.
Historical unknown rule versions are rejected rather than silently migrated.
It returns detached objects; accessors, toJSON hooks, sparse/custom arrays,
unknown fields, unsafe integers, invalid Unicode and oversized content fail.

The private reconstruction helper uses this validator; it does not modify live
state or validate every live read/write path. This remains a snapshot consistency
gate, not proof of a valid historical action sequence or permission to restore.
Future file import still needs bounded duplicate-key-aware raw JSON parsing,
archive authenticity/encryption and full cross-table validation before any write.
Tests cover all six templates and every permitted role's complete path, incorrect
answers/rulings, malformed/missing fields, owner/session mismatch and detached
private generated answer/graph preservation. No production restore is enabled.

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

Release gates passed: fast CI, actual workerd compatibility, deployment dry-run and
recorded rollback deletion drill results. Before backup/restore claims: complete state/import
validation, protected operator export of ALL required tables (including outcomes,
pending reservations and deletion guards), archive integrity/encryption, isolated
restore and cross-table verification. Accounts/progress/experiment backup remains
separate unfinished work. See BACKUP-ENVELOPE.md for the bounded encryption helper
and synthetic Node SQLite restore drill, neither of which is a production restore.
