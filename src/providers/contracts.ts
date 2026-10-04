// Server-only provider contract v1. No HTTP, SDK, credential, court-state or
// database types cross this boundary. Outputs remain untrusted proposals.
export type ProviderErrorCode = 'NOT_CONFIGURED' | 'INVALID_INPUT' | 'CANCELLED' |
  'TIMEOUT' | 'NETWORK' | 'QUOTA' | 'PROVIDER_AUTH' | 'MODEL_NOT_FOUND' |
  'UPSTREAM' | 'RESPONSE_TOO_LARGE' | 'INVALID_ENCODING' | 'RESPONSE_FORMAT' |
  'OUTPUT_TRUNCATED' | 'EMPTY_CONTENT' | 'ADMISSION_DENIED' | 'ADMISSION_UNAVAILABLE';
export type ProviderResult<T> = {ok: true; value: T} | {ok: false; code: ProviderErrorCode};
export interface ProviderContext {
  /** Optional final-answer deltas only. Never used for structured court output. */
  onText?: (text: string) => Promise<void>;
  signal?: AbortSignal;
  /** Includes headers and response-body consumption; no automatic retry. */
  timeoutMs: number;
  /** Optional stricter cap (<=64 KiB); default JSON 64 KiB, NDJSON 256 KiB. */
  maxResponseBytes?: number;
}
export interface TokenUsage {
  /** null means unreported, not zero or free. Never estimate billing here. */
  inputTokens: number | null;
  outputTokens: number | null;
}
export interface EmbeddingOutput { vectors: number[][]; usage: TokenUsage }
export interface RerankOutput { items: Array<{id: string; score: number}>; usage: TokenUsage }
export interface ChatInput {
  messages: ReadonlyArray<{role: 'system' | 'user' | 'assistant'; content: string}>;
  maxOutputTokens: number;
  temperature: number;
  output: 'text' | 'json';
}
export interface LLMProvider {
  readonly contractVersion: 1;
  readonly id: string;
  readonly model: string;
  generate(input: ChatInput, context: ProviderContext): Promise<ProviderResult<{text: string; usage: TokenUsage}>>;
}
export interface EmbeddingProvider {
  readonly contractVersion: 1;
  readonly id: string;
  readonly model: string;
  /** Preserve input order; finite vectors of the configured dimensions only. */
  embed(input: {texts: readonly string[]; dimensions: number}, context: ProviderContext):
    Promise<ProviderResult<EmbeddingOutput>>;
}
export interface RerankProvider {
  readonly contractVersion: 1;
  readonly id: string;
  readonly model: string;
  /** Return unique input IDs only; score is not a legal truth/confidence value. */
  rerank(input: {query: string; candidates: ReadonlyArray<{id: string; text: string}>; topK: number}, context: ProviderContext):
    Promise<ProviderResult<RerankOutput>>;
}
