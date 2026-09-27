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

NPC, case-generation and stage-dialogue call sites still use their existing
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
Production release and CI evidence follow separately after verification.
