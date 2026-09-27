# HTTP → provider correlation v1

Release 2026-09-28: source `bb9ffb903bc96b2189efa64854552049154980de`,
318 local fast tests and CI `36351089548` (checks + disposable local workerd)
passed. Dry run: 458.46 KiB / gzip 105.23 KiB. Existing Worker deployed as
`e45edfca-e4e4-4817-a789-5878d79e12c8`; no assets, bindings, migrations,
Secrets or payment changes. Existing log sampling remains 0.1, so records are
not an exhaustive billing ledger. No live inference was used to verify this batch.
Post-deploy GET capabilities/status returned 200; anonymous court sessions 401.
All three returned distinct server request/trace headers. This proves the HTTP
boundary, not production inference spans or successful authenticated court play.

Server-created `requestId` and `traceId` flow explicitly from `observeApiRequest`
through tutor/photo and CourtRoom/Learner RPC to the governed provider. The
server ignores caller trace headers and JSON fields. Correlation is not identity,
authorization, state version or idempotency. Optional last arguments preserve
existing internal callers; missing/invalid context disables tracing, not security.
The context schema is `contracts/trace-context-v1.schema.json`.

`ai.provider.completed` records contain only the copied context, random `spanId`,
feature, phase, bounded configured provider/model labels, timestamp, latency,
success/failure/exception, normalized error code, token counts and null cost.
No question, answer, reasoning, credential, user/court ID or exception text.
There is no global per-request state. Logger exceptions cannot change a result,
trigger retries or refund/regrant admission. Trace context is not stored in court
state, cached dialogue or public domain DTOs.

- `provider-call`: duration of the normalized adapter, including bounded transport
  processing; **not proof of network I/O**, e.g. NOT_CONFIGURED can return locally.
  Only this phase reports normalized usage; unknown/invalid counts are null.
- `governed-request`: includes admission/queue wait and provider call. Usage is
  always null to avoid counting the inner call twice. Missing admission emits a
  failure here without a provider call.
- Provider success is an untrusted proposal, **not** proof of domain acceptance,
  grounding or legal correctness. A late/invalid proposal can still be rejected.
- Pre-provider validation, reservation denial, dictionary answers, scripted or
  cached responses do not invent provider spans. Use HTTP records and response
  outcome contracts for those results. Token absence is not proof of zero cost.

Tests: `test-provider-tracing.mjs` checks strict copying, exact result/exception
preservation, privacy, usage and interleaving. `test-tutor.mjs` exercises actual
tutor + study admission + adapter with mocked inference; `test-court-journal.mjs`
exercises CourtRoom with real Node SQLite and mocked DO lifecycle/inference.
These are not live-provider, production log or complete workerd trace tests.

Compatibility/migration: no database or binding change; additive internal RPC
arguments only. Existing HTTP bodies/cookies remain unchanged. Rollback can
restore the previous source without data conversion. Deployment verification
must distinguish HTTP response headers from actually observed provider logs.

## Pipeline hooks (next source increment)

`pipeline-tracing.ts` adds an explicit server-only async hook for retrieval,
reranker and validator operations; `pipeline-trace-v1.schema.json` defines its
exact output. The hook preserves the operation's result/exception by identity,
never retries, and never serializes input/output/errors. Only a trusted
classifier can mark accepted/rejected; classifier failure becomes unclassified
without changing the domain result. Operation exceptions are recorded separately.
Trace IDs are copied before asynchronous work; no request-scoped global state.

Actual adoption: `proposeStageDialogue` now records the existing bounded JSON/text
validator after a successful provider proposal. Invalid JSON/shape/text is
rejected; provider failure emits no fake validator span. Accepted only means
this structural validator passed, not factual/legal accuracy or committed state.
CourtRoom still performs its existing deadline/version/deletion checks afterwards.
Cached replies do not rerun validation or inference. Old no-context callers keep
their prior behavior. No API/DB migration, new service or model call is required.
Rollback is code-only; no persisted data changes. Retrieval/reranker hooks are
available for future research adapters, **not** evidence that RAG is deployed.

Tests: pipeline schema/privacy/exceptions/concurrency, actual stage malformed
output classification, and CourtRoom SQLite propagation/cache regression.

Still incomplete: dedicated domain/DO spans and actual retrieval/reranker adoption;
parent-span hierarchy; pseudonymous authenticated-session correlation; bounded
log retention/accounting export; live-provider/real RPC trace evidence. No OTel
export service, paid feature or retention configuration was enabled by this batch.
