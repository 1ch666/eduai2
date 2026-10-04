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
- DELETE `/api/v2/court/sessions/:sessionId` (see deletion section)
- POST `/api/v2/court/sessions` (released 2026-10-04; see COURT-V2-CREATION.md)

The action POST body is the existing explicit **domain command v1**, defined by
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
version. Fixed-case creation is implemented separately with its own v2 schema;
random/AI creation and other platform APIs still require versioning work.
Unimplemented v2 routes return a v2 404.

## Versioned deletion — released 2026-10-04

Source `6ca74cf1300dc3b8b8df5514261a6ed679cd1a1e`; CI `37166684020`
passed fast checks and local-api. Deployment dry-run and actual deploy with
--keep-vars --strict passed. Worker version
`41233f8b-5385-4d01-92c7-c207667ab246`, bundle 479.08 KiB / gzip 110.17 KiB,
startup 2 ms. Ten site-name/static assets updated; no Unity build changed.
Working tree also contained user-owned Ollama comments only (manual redirect
behavior already committed); README/test comments/untracked AGENTS were not
included in the release commit. No Secrets or bindings changed.

Production probes: homepage 200 with requested Chinese name, capabilities/cases
200, anonymous v2 GET and DELETE 401 with v2 error envelope. The DELETE probe
used a synthetic all-zero UUID and no credentials; no real case was deleted.
Authenticated production deletion, new-table persistence and index recovery are
NOT yet production-verified. These were exercised only in local workerd.
Rollback reference: previous active Worker
`50e0524e-777f-46cc-aa85-09f99d74b757`; do not drop either deletion guard table.
The previous version was observed in Cloudflare, not assumed from Git history.

DELETE `/api/v2/court/sessions/:sessionId` now accepts the existing explicit v1
command shape, with actionId=`session.delete` and empty targetId/text. Login,
trusted Origin, CSRF and the existing court quota are mandatory. Content-Type is
application/json, body limit 8192 bytes, duplicate keys/invalid UTF-8/unknown
fields are rejected. Session ID must match the route; owner, case and expected
state version must match the stored session. Used action/NPC request IDs and
idempotency keys cannot be reused for deletion.

Success data follows `court-v2-deletion.schema.json`: immutable event/request/key
identity, session ID, previousVersion, terminal stateVersion=previousVersion+1,
timestamp and outcome=deleted. It is a deletion receipt, not a playable snapshot
or replay event. Case content, private snapshots, dialogue and action receipts
are erased transactionally. Only the existing owner deletion guard and one small
v2 receipt row survive (command metadata, no free text). Provider backups are not
securely erased by this operation. No restoration of the deleted case is offered.

Retry the **identical DELETE** after a lost response/500; never generate fresh IDs.
The receipt survives restart and old-route deletion retries. Different command
after deletion returns 409, foreign owner 404. A scene deleted by the old route
has no v2 receipt: return 409 rather than inventing one.

Released extension (2026-10-04, source `d148853`): GET
`/api/v2/court/sessions/:sessionId/requests/:requestId` also recovers the original
deletion receipt for its authenticated owner. Unknown commands, foreign owners
and legacy deletions return 404; malformed IDs return 400. Persisted receipt
corruption fails closed with a generic 500. The deleted-room query is SELECT-only
and exposes no erased action, dialogue or private state. Existing v1 behavior is
unchanged. This confirms **room erasure only**, not second-DO index cleanup;
retry the original DELETE after an ambiguous failure to finish cleanup.
No schema/binding migration is needed. Rollback removes this new GET capability
but preserves identical-DELETE recovery and all deletion guards.
Local evidence: 64 focused journal/handler tests, TypeScript, full fast gate and
actual isolated workerd HTTP tests passed on 2026-10-04. The HTTP test checks
unauthenticated/foreign-owner denial and recovers the exact deletion DTO; the
SQLite test forbids writes while querying after object reconstruction. Remote
CI and authenticated production acceptance are not inferred from these checks.

Release evidence: Fast regression CI `37167526814` passed both checks and local-api;
Pages workflow `37167526344` also passed. Wrangler 4.136.3 dry-run and
`deploy --keep-vars --strict` exited 0. Worker version
`b5c06fde-401f-46d8-a96e-c0ee76e89e95`, bundle 481.19 KiB (gzip 110.44 KiB),
startup 2 ms; no static asset changes. Functional source is committed `d148853`;
the existing uncommitted Ollama file differs only by user comments/blank lines.
No schema, binding, secret or account changes. Prior rollback reference:
`41233f8b-5385-4d01-92c7-c207667ab246`; retain all deletion guards.
Production anonymous capabilities/cases probes returned 200 and a synthetic UUID
outcome query returned v2 401 with null data and request/trace IDs. No production
account was created or case deleted for this check. Authenticated production
receipt recovery and cross-DO cleanup remain unverified.

The room commits first, then Learner removes its index/generated/random copies.
These two DOs are not a distributed transaction. If index cleanup fails, return
500; an exact retry retrieves the receipt and retries the idempotent cleanup.
Until then the list may have a stale entry, but the room is fenced against reads,
actions and delayed provider writes. An orphan-cleanup operator remains future work.

Migration: additive `court_v2_deletion` table with schema_version=1 and one row
per deleted room; no ALTER, DROP, binding or secret changes, no backfill. Rollback
keeps this table and existing `court_deleted` guard intact. Old code ignores the
new receipt and still honors deletion; v2 DELETE becomes unavailable until
redeployment. Never restore an older archive over a deletion guard. No production
restore or user-data deletion was executed in this batch. The additive table is
initialized lazily when a production CourtRoom instance starts after deployment.

Evidence: TypeScript and local fast gate 425 tests passed; actual local workerd
HTTP suite passed authenticated/foreign-owner/CSRF/stale-version checks, parallel
same-command deletion, exact receipt recovery, index removal and legacy retry.
SQLite tests cover transaction rollback after erasure and before receipt write,
restart, ID collisions and the expanded 13-table synthetic backup inventory.
Handler tests inject second-DO cleanup failure. Remote CI and production release
verification must be recorded separately. Existing frontend/Unity still use their
old deletion flow; this addition does not silently change their behavior.

## Evidence and limits

`test-court-v2.mjs`: schema, exact forwarding, safe errors/exceptions, preflight,
and unsupported-route isolation. `check-court-v1-api.mjs`: disposable workerd
accounts; cross-account/CSRF rejection, raw duplicate keys, simultaneous v1/v2
same-command execution, recovery, stale version and one-event commit checks.
No live inference is needed. These checks do not prove all platform APIs are
versioned or that all production authenticated workflows have been exercised.
Release evidence must be appended after actual CI/deployment, not inferred from
source or unit tests.

## Read-only event audit (released 2026-09-28)

Source a68df68; 52 focused tests, local fast CI, deployment dry-run and remote
CI 36352765265 (checks + actual workerd integration) passed. Worker version
6df7235c-2523-4af3-a5d6-37e1b1fcce6c; upload 464.90 KiB / gzip 106.75 KiB.
No static asset update or migration. Production anonymous events GET returned
401, POST returned 405; v2 metadata matched request headers. Authenticated
production event retrieval remains unverified; local workerd owner tests passed.

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
