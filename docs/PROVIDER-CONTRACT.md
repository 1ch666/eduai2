# Server provider contract v1

## Stage dialogue extraction (2026-09-28, local verification)

`src/court-dialogue.ts` now takes an `LLMProvider` and an explicit public-view
input, returning a text proposal or null. The route keeps authentication, CSRF,
rate checks, cached-turn lookup and version-checked storage. Null selects the
original scripted turn; failures are not labelled successful AI dialogue.
The existing prompt, 250-token limit, temperature 0.3, 15-second deadline,
16 KiB envelope cap and 240-character text gate remain. Default composition
uses the existing Ollama model with thinking disabled, as before.

Only selected public fields enter the prompt. Additional output fields such as
stage/score are never applied. Tests cover private-field canaries, immutable
input, malformed/oversized replies and every provider failure code without
retry. 16 focused tests, TypeScript and the full local fast gate passed. No
live inference or semantic-grounding claim. No schema/binding/Secret/UI/Unity
changes; rollback needs no data conversion. CI and deployment remain pending.
Stage dialogue still has only per-version result caching, not a durable
in-flight provider reservation: concurrent calls can consume duplicate quota.
Global backpressure and that reservation remain work, not claimed complete.

Authoritative TypeScript contract: `src/providers/contracts.ts`.
`LLMProvider`, `EmbeddingProvider`, `RerankProvider` return a discriminated
`ProviderResult`, never a vendor response or exception containing private text.
This is an internal server interface, not a public browser endpoint or DTO.

Rules for implementations and consumers:

- Model and credentials come from server configuration; user input cannot select
  an endpoint, key, vendor or paid model. Contract fields never include secrets.
- `ProviderContext` carries a caller cancellation signal and bounded timeout.
  Implementations must stop network/body work on cancellation and timeout.
  Optional `maxResponseBytes` allows a stricter envelope cap (integer 1–65536);
  omission preserves 65536. NPC requests retain their existing 32768 cap.
- No automatic retries. Timeout/network failure does not prove the provider did
  not process or bill a request. A later orchestration layer must govern budgets,
  concurrency, deduplication and any explicit retry policy.
- Only final answer text is returned; never substitute reasoning, tool calls or
  hidden model output for an answer. JSON output still needs domain validation.
- `inputTokens` / `outputTokens` are nonnegative safe integers or null for unknown.
  Unknown is not zero. Token counts do not imply a price, a free quota or budget.
- Embeddings preserve order/dimensions; rerank IDs must belong to the supplied
  set and be unique. Future adapters must test these constraints before enabling.
  `src/providers/validation.ts` validates normalized outputs before consumption:
  embedding count 1–32, dimensions 1–4096 and total scalars at most 65536;
  rerank candidates 1–100 (unique safe IDs), exactly topK results in descending
  score order. Scores may be negative, but must be finite; they are not assumed
  to be probabilities. Limits are engineering caps, not claims about a model.
  Missing/extra fields, malformed usage and sparse arrays are rejected. Valid
  results are copied, so a provider retaining its own output cannot mutate the
  validated result later. These checks cannot prove vector quality, input-order
  semantics, relevance or that supplied candidates were authorized: projection
  and retrieval permissions remain the caller's responsibility.
- No provider can commit court state, add evidence, score an answer or override
  owner, CSRF, role, procedure or fact validation.

## Compatibility / current rollout

The existing tutor adapter is extracted into `src/providers/ollama.ts`; no new
service/model/key is installed. `src/ai.ts` retains auth/rate-limit/dictionary,
prompts and public response mapping. The route's success fields and existing
error codes remain compatible. Caller cancellation adds `CANCELLED` (HTTP 503).
The 50-second tutor deadline, 64 KiB upstream limit and existing gpt-oss low
thinking option remain. These preserve existing policy, not a claim of model
capability or live-provider acceptance. See https://docs.ollama.com/api/chat .

The adapter sends a single POST to the fixed Ollama HTTPS endpoint, refuses
redirects, strips vendor reasoning and logs no payload. Tests use an injected
transport, never a real key or paid model. Embedding and rerank are interfaces
only: no actual adapter, retrieval/vector database or benchmark is claimed.

NPC now uses the same interface, retaining its 15-second deadline, existing
prompt and plain-text transport (JSON is requested in the prompt, not forced by
the vendor format flag). Domain JSON/schema/fact-ID validation stays in
`court-npc.ts`. Provider `RESPONSE_FORMAT` maps to legacy `ENVELOPE_JSON`; all
other existing codes/fallback fields remain. The optional server-only provider
argument is for tests/composition, never a client-selectable provider.
Case-generation and stage-dialogue still use their existing
implementations and require separate migration and compatibility tests. This
batch does not claim all domain logic is vendor-independent. No SQL, binding,
Secret or permission change is needed. Reverting the tutor extraction restores
the previous code without changing stored data.

## Evidence and remaining gates

`scripts/test-provider.mjs` tests the actual adapter with injected transport:
fixed endpoint/redirect policy, final-answer projection, usage nullability,
credential nonserialization, malformed bounds, pre/in-flight/body cancellation,
timeout classification, no retry, response limits and stream cancellation,
HTTP error categories, JSON mode and extra-field exclusion. Existing
`scripts/test-tutor.mjs` tests the actual migrated route and legacy error codes.
Full local fast gate passed 191 tests, TypeScript, frontend and WebGL checks.

These are deterministic transport tests, not evidence that a production model,
quota, billing policy or mobile disconnect propagation works. Embedding/rerank
adapters, integration of the standalone output validators, global backpressure/circuit breaker,
durable budgets and full request tracing are not completed by these interfaces.
Release source `d502822294e8e6d64ff7e5f499be2d72fb849a52` was pushed to main.
Both GitHub fast and isolated workerd integration jobs succeeded:
https://github.com/1ch666/eduai2/actions/runs/36337119591 .
Dry-run passed; existing Worker deployed with `--keep-vars --strict` as version
`6bda6a1e-b057-434c-a01f-52b26f7070a1`. No static assets changed.
Production `/api/ai/status` returned 200 with the existing Ollama/gpt-oss:20b
configuration, and empty `/api/ai/ask` returned 400 with trace headers before any
model call or quota operation. No live inference was requested; configuration
presence is not provider availability evidence. Prior rollback Worker version is
`66ef3a88-4382-4637-97e0-dc5040da5620`; no data migration is involved.

## NPC follow-up release

Source `3bd2dc57c10310fef9a639f71d0280c6dc9cf996` migrates NPC transport only.
The existing prompt, knowledge projection, domain fact-ID/schema checks,
fallback, rate/kill switches and state commit code remain unchanged. Tests add
an alternative fake provider, prove it receives only the projected payload,
reject invented IDs without changing state, retain kill/rate guards and cancel
an oversized 32 KiB stream. The full local fast gate and CI succeeded:
https://github.com/1ch666/eduai2/actions/runs/36337441610 . CI includes isolated
workerd auth, court v1/replay and committed-NPC lost-response recovery checks.

Dry-run and existing Worker deployment succeeded, version
`1c60ac3d-5064-4499-94c7-a66c218c8ecd`. Production read-only capabilities and
court cases returned 200; anonymous sessions returned 401, all with trace
headers. No live NPC inference, production mutation, new service, key change,
data migration or Unity rebuild was performed. Actual provider quality/latency
is not verified by these checks. Prior Worker rollback version:
`6bda6a1e-b057-434c-a01f-52b26f7070a1`.

## Retrieval-provider validation foundation

`parseEmbeddingOutput` and `parseRerankOutput` now implement the normalized
output rules above. `scripts/test-provider-validation.mjs` verifies limits,
copy isolation, missing/extra fields, finite values, nullable usage, membership,
duplicates, ordering, sparse arrays and 512 seeded malformed pairs. These pure
functions perform no fetch/storage/model calls. Future adapters must invoke
them after bounded JSON parsing; adding them is not proof of an integrated RAG
pipeline. No actual embedding/rerank provider or public route currently invokes
them, so this batch does not need a production deployment or data migration.

## Case generation transport migration (2026-09-28, deployed)

`generateModelCase` now accepts an optional server-only `LLMProvider` and validates
its normalized text with the existing narrative and reachability validators.
No client provider override was added. Existing prompt, 1600-token limit,
temperature 0.9, 20-second deadline and 18,000-byte response cap are preserved.
The Ollama adapter has an optional server configuration `thinking:false` to
retain generation's previous wire behavior; tutor/NPC defaults remain unchanged.
Quota errors keep the existing quota message; exceptions are sanitized and no
automatic retry occurs. The explicit kill switch still blocks injected providers.
Library fallback, generation history, quotas and storage are unchanged.

18 offline generation/provider/validator tests and TypeScript passed. Tests use
fake transports only, including a different provider, invalid drafts, oversized
text, upstream failures and immutable history. No live model quality claim.
No schema, migration, Secret, binding, frontend or Unity change. Rollback can
restore the previous runtime code without data conversion. CI and production
verification are recorded below; stage dialogue still needs provider migration.

Source `950f04ec31bdd1bc0d4bf497f456bf073880d6d7` passed fast and isolated
workerd API CI: https://github.com/1ch666/eduai2/actions/runs/36342149022 .
Wrangler dry-run and strict deployment with preserved variables succeeded.
Worker version: `9084a8ca-bd34-4e07-a115-ff5ea7c36031`.
No static assets changed. Read-only production probes verified capabilities
200, court cases 200 and anonymous sessions 401, each with a trace header.
No production case creation or live inference was performed; these probes do
not prove model availability or narrative quality. Previous rollback version:
`8681a49b-afb9-4234-8aaa-a68ee1f622db`. No data conversion is needed.
