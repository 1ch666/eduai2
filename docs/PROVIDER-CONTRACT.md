# Server provider contract v1

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
adapters and their output validators, global backpressure/circuit breaker,
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
