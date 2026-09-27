# HTTP → provider correlation v1

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

Still incomplete: dedicated domain/DO, retrieval, reranker and validator spans;
parent-span hierarchy; pseudonymous authenticated-session correlation; bounded
log retention/accounting export; live-provider/real RPC trace evidence. No OTel
export service, paid feature or retention configuration was enabled by this batch.
