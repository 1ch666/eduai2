# Versioned court creation — candidate 2026-10-04

Not yet deployed. Existing fixed/random/AI creation routes and client behavior
remain available. This addition versions fixed teaching-case creation only;
it does not replace the random/AI generator or claim those APIs are now v2.

## Contract and recovery

POST `/api/v2/court/sessions`, JSON body matching
`contracts/court-v2-create.schema.json`. Allocate requestId, idempotencyKey and
lowercase UUIDv4 sessionId once, retain the complete command across failures.
ExpectedStateVersion is exactly 0 and means an **absent** room; an existing
version-zero room cannot be overwritten. Config is checked by the same server
rules as legacy creation, including role, ages and required assistance.
Duplicate JSON keys, invalid Unicode/numeric spellings, extra fields and bodies
over 4096 UTF-8 bytes are rejected. Owner identity comes only from the session.

Requires login, trusted Origin and CSRF; existing per-learner create quota (six
requests/minute) and 100-room capacity apply. GET/other methods on the collection
return 405. Format/type/size failures return 400/415/413, quota 429, capacity or
conflicting command 409, foreign/deleted room 404. No provider/model call occurs.

Success is 201 with v2 HTTP envelope and the original v1 session_started event
in data. An exact duplicate returns the **same creation event**, even after the
room advances; this is not the latest playable snapshot. GET
`/api/v2/court/sessions/{sessionId}/requests/{requestId}` recovers the event.
Refresh the session snapshot before acting. A 404 on recovery is not permission
to invent new IDs: retry the identical POST after backoff, subject to quota.
After deletion, both creation retry and creation-result reads return 404 and
cannot resurrect the scene. Idempotency identity is scoped to owner + sessionId;
reusing a key with a different session ID is a different command, not global dedup.

## Storage, compatibility and rollback

No new tables, bindings, secrets or migration tags. CourtRoom atomically writes
state, public/private journals and canonical creation command + resulting event
into the existing court_v1_requests receipt table. Legacy recovery can read the
public event; subsequent v1 commands cannot reuse its request/key. No old data
is rewritten. Deletion already erases this table. The v2 public audit verifies
the saved creation command against the exact persisted event, including session,
request, case and role, and emits provenance `verified-creation-v2`. Genesis uses
previousVersion=null (no predecessor), newVersion=0 and the saved idempotency key.
It never invents a version -1 or treats an existing v0 state as its predecessor.
Missing/mismatched receipts remain `unattributed`; historical records are not
rewritten. Audit reads stay SELECT-only and owner-gated. Clients validating the
v2 event enum must use the updated contract before consuming new creation events;
v1 event DTOs and legacy creation behavior do not change.

Learner reserves an index slot **before** CourtRoom initialization. Duplicate
reservation succeeds even at capacity without rewriting the existing title.
An ambiguous room RPC failure leaves that slot so retry can finish creation.
A known 404 removes the caller's index entry. These DOs are not a distributed
transaction: an abandoned reservation may remain visible/counted until cleanup.
Do not retry with fresh IDs or claim automatic orphan reconciliation exists.

Rollback to the preceding Worker retains all rows. Older code can operate on
the room and read its event; it does not expose the new POST route. Never clear
receipts/deletion guards as a rollback step. No production data cleanup is needed.

## Evidence and outstanding work

Tests cover strict contract, atomic rollback on receipt failure, exact retry
after object recreation, post-action retry without state regression, foreign
owner, changed command, legacy-room protection, delete/no-resurrection and index
capacity. Real local workerd HTTP tests cover concurrent POST, outcome recovery,
CSRF/owner denial and compatibility with the existing actions/NPC/random routes.
The runtime test initially caught null-prototype wire objects failing RPC;
creation now copies config into a plain record, with a regression assertion.
Focused tests, TypeScript and full fast gate ran; final focused rerun includes
that serialization fix. Source df3dbf9 CI 37168204640 (fast + local-api) and
37168204141 (Pages) passed. The subsequent provenance increment has 71 focused
tests plus typecheck passing; the full fast gate and actual local workerd HTTP
suite also passed with genesis provenance assertions. The SQLite audit test
forbids all non-SELECT statements while reading and rejects false provenance
for changed session/request/case/role or mismatched saved event.
Production authenticated creation and the new increment's remote CI remain
pending. No frontend/Unity adoption, generated-case v2 flow or complete
mutation-provenance claim is made by this increment.
