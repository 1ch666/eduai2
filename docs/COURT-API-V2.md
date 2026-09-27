# Court HTTP v2 — additive transport contract

Released 2026-09-28: source `50efc039b9dd3b69f2f3aeb919282e6ed8b37cf1`;
325 local fast tests and CI `36351960047` (checks + actual local workerd) passed.
Worker `6aff28bc-e363-4649-abe3-f09943dc62c4`, upload 461.55 KiB / gzip 106.09 KiB.
Post-deploy anonymous v2 session GET returned 401, unknown v2 route 404; both had
valid v2 metadata matching HTTP request/trace headers. Legacy cases GET was 200.
No authenticated production mutation/model test, migration or static asset change.

## Routes

- GET `/api/v2/court/sessions/:sessionId?requestId=:commandCorrelationId`
- POST `/api/v2/court/sessions/:sessionId/actions`
- GET `/api/v2/court/sessions/:sessionId/requests/:commandRequestId`
- GET `/api/v2/court/sessions/:sessionId/events?after=-1`

The POST body is the existing explicit **domain command v1**, defined by
`court-v1-command.schema.json#/definitions/mutation`. It still requires
`apiVersion:1`, `requestId`, `idempotencyKey`, `expectedStateVersion`, session/case
IDs and the action fields. HTTP transport v2 does not silently invent a second
command protocol or change canonical command identity. GET snapshot correlation
remains required and validated exactly as on the original endpoint.

Every JSON response has the exact schema `court-v2-response.schema.json`:
`ok`, `apiVersion:2`, server `requestId`, `traceId`, `timestamp`, `errorCode`,
`stateVersion`, `data`. `data` is an unchanged v1 public snapshot, event, or
not-applied receipt on success; null on failure. No private court state is added.
`stateVersion` is the version of the returned DTO, not necessarily the latest
version after a cached replay. It is null for not-applied/error responses; the
adapter does not make an extra read or leak another owner's current version.

Outer requestId/traceId match HTTP X-Request-ID/X-Trace-ID and are fresh for every
attempt. Inner data.requestId is the original domain command/correlation ID.
Recovery returns identical **data**, not identical outer timing/trace metadata.
`errorCode` is a stable HTTP classification (`HTTP_400`, `HTTP_401`, `HTTP_403`,
`HTTP_404`, `HTTP_405`, `HTTP_409`, `HTTP_429`, etc.; 500 is `INTERNAL_ERROR`).
These are not invented fine-grained domain reasons. Error data and exception
messages are omitted. Clients must reconcile uncertain mutations with the
original command ID; do not submit a new idempotency key merely after HTTP 500.
Successful CORS OPTIONS is bodyless 204, as required by HTTP.

## Preservation, migration and rollback

The adapter forwards raw request bytes/headers to the existing handler, preserving
duplicate-key, encoding, length, CSRF, Origin, login, rate, owner, stale-version
and idempotency checks. It performs no provider retry and has no state store.
v1 and v2 share the same persisted outcomes: switching transports does not create
a second execution budget or bypass a used key. Trace paths are templated.

No SQL migration, data rewrite, new binding, cookie or secret. Legacy routes and
web/Unity clients remain unchanged. Rollback restores old code without database
conversion; new v2 clients must explicitly support the v1 transport or wait for
redeployment. Never automatically retry an uncertain mutation through another
version. Creation/deletion and other platform API contracts still require
separate versioning work; unimplemented v2 routes return a v2 404.

## Evidence and limits

`test-court-v2.mjs`: schema, exact forwarding, safe errors/exceptions, preflight,
and unsupported-route isolation. `check-court-v1-api.mjs`: disposable workerd
accounts; cross-account/CSRF rejection, raw duplicate keys, simultaneous v1/v2
same-command execution, recovery, stale version and one-event commit checks.
No live inference is needed. These checks do not prove all platform APIs are
versioned or that all production authenticated workflows have been exercised.
Release evidence must be appended after actual CI/deployment, not inferred from
source or unit tests.

## Read-only event audit (candidate, not yet released)

The events route requires an authenticated owner. Its data follows
`contracts/court-v2-events.schema.json`: at most 20 events ordered by version,
`nextAfter`, and the current `stateVersion`. Cursor `after` is an integer from -1
through MAX_SAFE_INTEGER; invalid UUIDs/cursors are rejected. Continue with
nextAfter only while events arrive. Stop on an empty page even if stateVersion is
ahead: an old history gap is not repaired or filled by this read endpoint.

Each event adds eventVersion, eventType, actorRole, previousVersion, newVersion
and idempotencyKey around the existing public event payload. Provenance is
`verified-command-v1` only when the saved strict command and exact resulting
event agree. actorRole is the invoking player's role, not the NPC speaker.
Missing or inconsistent receipts produce `unattributed` and null actorRole,
previousVersion and idempotencyKey; version minus one is never fabricated.
Persisted records with wrong session/case/row identity or malformed public DTOs
fail closed with the standard 500 envelope, without disclosing the record.

This method executes SELECTs only: no checkpoint, event repair, state advance,
provider call or migration. It exports public snapshots for historical viewing,
not hidden truth, full command bodies or authoritative database backups. Complete
internal state reconstruction and backup/restore remain separate unfinished work.
Legacy event APIs remain unchanged. Rollback removes this additive route only.

Coverage: actual SQLite tests assert total_changes is unchanged, historical gaps
stay empty, mismatched receipts remain unknown, malformed/cross-session records
fail closed. The workerd API check adds owner/anonymous isolation, cursor/method
rejection and agreement with the original command event. CI and production
evidence must be recorded separately after execution.
