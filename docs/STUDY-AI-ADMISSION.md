# Study AI admission / compatibility (2026-09-28)

## Scope and protocol

`POST /api/ai/ask` (including its legacy court mode) and
`POST /api/photo/explain` now reserve an attempt before composing the governed
Ollama provider. Existing successful JSON shapes and input limits stay unchanged.
Dictionary answers remain local and consume no model admission. Photo remains
confirmed-text explanation, NOT OCR/vision; no picture reaches this pipeline.

New error responses retain `error` and add a stable `code`:

| HTTP | code | Meaning / client behavior |
| --- | --- | --- |
| 409 | AI_ATTEMPT_ALREADY_USED | Request may be running, done or interrupted. Do not automatically create a new ID or repeat inference. No answer cache exists. |
| 409 | AI_REQUEST_CONFLICT | Same owner/endpoint/request ID was reserved for different model input. Reject reuse. |
| 503 | AI_ATTEMPT_CAPACITY | Legacy tombstone capacity reached. Do not clear storage or switch owners to bypass it. |
| 503 | ADMISSION_UNAVAILABLE | Reservation/coordinator could not be confirmed. No raw-provider fallback. |
| 503 | ADMISSION_DENIED | Shared admission did not grant this attempt. No inference performed by this caller. |

Successful first response can still be lost in transit. This change provides
at-most-once admission for a retained legacy request, **not exactly-once delivery
or replayable answers**. It intentionally does not persist full private inputs
or responses to supply an answer cache. Only a new intentional user action may
use a new UUID; clients must not do that as a hidden retry strategy.

## Identity, storage and limits

- Owner comes from the verified session. Guest tutor uses a server-derived hashed
  network bucket (`guest:<networkKey>`), NOT the client-controlled clientId. Guests
  sharing a network also share its budget; network changes can change this bucket.
  This is abuse containment, not guest authentication or strong anonymization.
- `Learner.reserveStudyAi` is an internal typed RPC, not a public HTTP endpoint.
  Owner selection remains in the authenticated/edge handler, never body JSON.
- Each owner's Learner stores only kind, request-ID SHA256, input fingerprint and
  server issuance timestamp. The fingerprint is not encryption: low-entropy text
  can be guessed against a digest. Do not publish/export these rows as analytics.
- A synchronous SQLite transaction initializes version-1 metadata and tables and
  atomically checks/inserts one reservation. No external I/O inside it. Duplicate,
  conflicting or lost-reply retries never acquire a fresh issuance timestamp.
- Reservation RPC has a one-second receipt timeout; a late success cannot launch
  a provider call. The original reservation is conservatively retained.
- All production Ollama construction now goes through governed-ollama.ts. Tutor
  and photo share a `study` scope and the same verified-user budget as court calls.
  The existing account coordinator enforces UTC daily attempt limits, concurrency,
  queue and circuit controls. This is not monetary accounting or a promise of
  vendor free quota. Existing HTTP origin/auth/CSRF/rate guards are preserved.

## Explicit legacy limitation / next version

These legacy clients send random UUIDs without a verifiable server expiry.
Deleting old tombstones would let old/unknown requests regain admission. Therefore
this version never prunes them and caps the combined tutor/photo records at
**4,096 per owner bucket**. The cap includes failed/denied reservations, not only
successful inference. At capacity new study AI calls fail closed; dictionary and
other learning functions are not disabled. This is a finite legacy compatibility
limit, NOT an indefinite high-volume production retention solution.

A future versioned request-ticket API should issue server-verifiable bounded-life
attempts, reject expired tickets before reservation, and migrate clients before
adding safe tombstone cleanup. Do not silently prune or reset this legacy table.
This remains a production-engineering follow-up, not a completed retention gate.

## Additive migration / rollback

No new Cloudflare class, binding or Wrangler migration is required. On first
study reservation only, the existing Learner adds `study_ai_meta` and
`study_ai_attempts` atomically. Existing courts, generation requests, limits and
all account/progress data are untouched. Unknown version, missing half-schema or
failed write fails closed; it never resets prior reservations. Old Worker code
can ignore these tables but would bypass this protection for tutor/photo.

Prefer a forward fix, preserving tables and the coordinator. Turning
AI_ADMISSION_ENABLED off rejects new governed calls and retains local dictionary /
court scripted or library fallback. Do not roll back to pre-adoption code while
claiming the switch still protects every route. No Secret/owner/permissions or
paid-service changes are part of this release.

## Evidence and remaining gates

Local `ci-fast.mjs` passed 298 tests plus type/frontend/Unity artifact checks.
The default handler tests use real Node SQLite with lifecycle/RPC doubles and
synthetic providers; they cover concurrent duplicate, conflicting input, unknown
result, timeout/late receipt, guest identity, auth/CSRF and privacy projections.
`check-admission-runtime.mjs` also passed actual local workerd Learner RPC with
eight concurrent reservations, one grant, payload conflict and owner isolation.
No live model call or production data mutation was used for these tests.

Wrangler dry run passed: 450.82 KiB / gzip 103.30 KiB. Remote CI/deployment must
be recorded separately after confirmation. Capability/status endpoints still
report configuration rather than live quota; truthful availability, versioned
tickets/retention, full tracing and broader goal gates remain incomplete.
