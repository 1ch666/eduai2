# API boundary observability — 2026-09-28

## Implemented contract

`src/telemetry.ts` wraps the real `src/index.ts` API dispatcher. Every completed
`/api/*` HTTP attempt (including unknown routes, OPTIONS, rejected auth and caught
exceptions) returns `X-Request-ID` (server UUID v4) and `X-Trace-ID` (32 hex digits).
Trusted-origin responses expose these headers to browser code; no origins,
credential policies or request-header allowlists were broadened.

One `http.request.completed` structured console record is emitted per attempt.
Its machine-readable shape is `contracts/http-trace-v1.schema.json`:
requestId, traceId, timestamp, endpoint template, method, latencyMs, status,
errorCode and safeSessionId. The last field is currently **null**, not a claim of
authenticated session correlation. `HTTP_409` etc. classify HTTP results only;
`INTERNAL_ERROR` means an exception escaped the route. A 200 fallback does NOT
prove AI success. Domain error codes and AI pipeline metrics remain separate.

The boundary's requestId identifies an HTTP attempt. It is NOT the court JSON
requestId / idempotencyKey. Recovery GETs and repeated commands have fresh HTTP
IDs while retaining their original domain command identifier. JSON response
bodies and strict v1 schemas are unchanged. No body is cloned, parsed or buffered
for logging; response streams, status, cache policy and Set-Cookie are preserved.

Caller-supplied tracing headers are ignored, not trusted as a parent context.
This is not yet an OpenTelemetry trace or a full cross-service trace tree.

## Privacy and operational boundary

- No request/response bodies, Cookie, Authorization, recovery codes, IPs,
  display names, model prompts/replies, images or audio are read by this logger.
- Endpoints come from a finite allowlist. Dynamic court/group/user/slot/NPC and
  invitation segments are replaced with templates. Unknown paths collapse to
  `/api/:unmatched`; query strings and raw exception messages/stacks are omitted.
- HTTP method is also allowlisted; custom method text cannot enter the record.
- No global mutable request context, credential-derived hash, new storage,
  provider, service, secret or paid feature was introduced.
- Existing Cloudflare observability configuration is unchanged (10% log head
  sampling). A response ID does not guarantee a persisted log or exact counts.
  Inspect application `http.request.completed` records when troubleshooting;
  platform invocation metadata has its own policies and may include request URLs.
  Never put secrets or private question text in query strings. Application-level
  redaction is NOT a claim that all platform/vendor metadata has been audited.
- Logger failures are swallowed after the operation returns, so a telemetry sink
  cannot turn an already committed mutation into an apparent application failure.
  A runtime crash/termination before completion may produce no completion record.
- Static assets are not traced by this API wrapper. Caught asset exceptions emit
  only a fixed event/error code, never raw paths or exception messages.

## Incident use

1. Obtain only the failing response's X-Request-ID, time, HTTP status and page;
   do not ask a learner to send cookies, passwords or a full private transcript.
2. Search the existing Worker logs for that ID and the completion event. If the
   record was not sampled, absence is not proof that a request never executed.
3. For an uncertain court mutation, use the existing authenticated outcome GET
   and domain requestId; do not replay a POST just to create telemetry.
4. Do not infer cause from HTTP status alone. Provider quota, timeout and schema
   failure still require separate existing provider diagnostics.

## Validation / rollout / rollback

- `scripts/test-telemetry.mjs`: actual module, schema compliance, rejected extra
  private field, body/cookie/CORS preservation, path redaction, exception privacy,
  concurrent isolation, spoofed identifiers and sink failure. No timing sleeps.
- `scripts/check-api.mjs`: real isolated workerd responses, fresh header IDs,
  OPTIONS, auth cookies and logout, including all its 400/401/403/404/409 cases.
- Existing court v1/replay/NPC lost-response integration must still pass; no
  frontend or Unity DTO change is needed.
- Local fast CI: 184 tests, TypeScript, frontend and WebGL gates passed. Local
  workerd auth, court v1 and NPC recovery integration passed before rollout.
- Deployment status is recorded after actual release, not inferred from a push.
  This release needs no SQL/schema/binding migration. Revert only this boundary
  change if required; do not reset accounts or court data. Prior deployed Worker
  version: `6dbb61e6-5e4a-41f8-b60f-90115eece3d9`.

## Verified release

Source `a737abbd7e79d04dcc90870dc6a7ed5291117592` pushed to `main`.
GitHub fast checks and isolated API job both succeeded:
https://github.com/1ch666/eduai2/actions/runs/36336644180 .
Wrangler dry-run succeeded, then `deploy --keep-vars --strict` published existing
Worker version `66ef3a88-4382-4637-97e0-dc5040da5620`. No asset files changed.
No Secrets, bindings, migrations, billing or permissions were changed.

Production read-only checks verified headers and trusted Pages CORS on
`/api/capabilities` (200), anonymous `/api/auth/session` (200), anonymous
`/api/court/sessions` (401), and an unknown API route (404). This did not create
accounts, alter production data, consume model tokens or verify persisted sampled
logs. No Unity/Docker assets changed; the previous grounded-game build remains.
The disposable local Worker used for integration was stopped after testing.

## Still required by the full goal

Authenticated pseudonymous context with a defined retention policy; browser →
API → DO → orchestrator span propagation; bounded retrieval/reranker/provider/
validator hooks; provider/model/token/cost/fallback metrics; domain error-code
alignment; abuse/audit reporting; crash/timeout traces; full platform-log privacy
review and verified retention. This boundary foundation does not complete the
observability, tracing, cost-governance or production gates.
