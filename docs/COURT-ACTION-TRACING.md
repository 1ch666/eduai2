# Court action tracing

`contracts/court-action-trace-v1.schema.json` defines the new bounded log record.
HTTP server-created requestId/traceId are forwarded to legacy and versioned
CourtRoom action methods. The synchronous observer emits interface, random span
ID, timestamp, elapsed milliseconds and status only. It never records action
text, exception messages, owner/session identity, facts, evidence or result DTOs.
Missing/invalid trace context preserves existing direct callers without logging.

The wrapper introduces no await between validation and transaction commit.
Returned results and thrown exceptions retain their identity; logging failure
cannot turn committed work into a failed request. Exact cached retries produce
another successful request span, not another event or mutation. Logs are sampled
operational diagnostics, not a durable audit ledger or unique-action counter.
Status 409 does not distinguish stale versions from rule/idempotency rejection;
fine-grained validator stages and parent/child span hierarchy remain future work.

Legacy action previously caught transaction failures as 409 and returned the
underlying exception message. Only transition rejection is now handled as 409;
storage/journal failures propagate to the existing HTTP exception boundary as
generic 500. Clients must reconcile unknown outcomes using the original command
identity, never generate a new command merely after a 500. Transaction rollback
and exact retry behavior remain covered by actual SQLite tests.

Tests: `node --test scripts/test-court-tracing.mjs scripts/test-court-journal.mjs`
passed 68 groups. They verify schema allowlists, privacy, synchronous result
identity, logger failure, owner rejection, storage rollback, cached retries and
no persistence of trace IDs. These are Node SQLite lifecycle tests, not a claim
of production log verification. Full local `node scripts/ci-fast.mjs` passed;
remote CI and workerd release evidence are recorded below. Production action log
inspection remains open.

No migration, storage change, frontend change or new logging service. Existing
Worker log configuration/retention is unchanged. Rollback is code-only, but
restores legacy storage-error misclassification. NPC/creation/deletion paths
are not instrumented by this action observer. No AI inference used in tests.

## Release evidence — 2026-10-04

Runtime implementation `ea63be3`; release source
`71be82160f1096096fdec8e9de45879a6b380974` adds actual workerd log verification.
CI `37169960144` passed checks/local-api. The disposable HTTP suite exercises
legacy success, identical retry and stale rejection; the log checker validates
both legacy/versioned 200/409 records against schema and joins every observed
action to HTTP completion by requestId, traceId and status. This is genuine local
workerd evidence, not production sampling. No log payloads are printed by the
checker. CI reports pinned action Node runtime deprecation/runner-image warnings;
these are not failures, but require a separate deliberate toolchain update.

Dry run and `deploy --keep-vars --strict` succeeded. Worker version
`d45202ae-a016-41c4-9d4b-00feecd22229`, bundle 491.13 KiB / gzip 112.15 KiB,
startup 2 ms, no changed assets. Existing user-owned provider comments/whitespace
were present; functional source matches the commit. Rollback version:
`acb2d090-7978-45b6-a2d4-22ec526c2bab`.
Production anonymous capabilities/cases returned 200 and v2 session read returned
401 with valid request correlation. No authenticated production mutation or
live action log inspection performed. No secrets, permissions or schema changed.
