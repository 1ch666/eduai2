// Shared HTTP helpers: CORS for the trusted study sites, JSON replies with
// no-store caching, and body readers that stop before memory or size abuse.

export const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff"
} as const;

// Only these sites may send credentialed or state-changing requests.
export const TRUSTED_WEB_ORIGINS = new Set([
  "https://civic-law-lab-212.yichengc869.workers.dev",
  "https://s141374-crypto.github.io",
  "https://1ch666.github.io"
]);

export function responseHeaders(origin?: string): Headers {
  const headers = new Headers(JSON_HEADERS);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
    headers.set("Access-Control-Max-Age", "86400");
    headers.set("Vary", "Origin");
  }
  return headers;
}

export function json(data: unknown, status = 200, origin?: string, cookies: string[] = []): Response {
  const headers = responseHeaders(origin);
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return Response.json(data, { status, headers });
}

export type Responder = (data: unknown, status?: number, cookies?: string[]) => Response;

type BodyResult =
  | { text: string; tooLarge?: never; invalidEncoding?: never }
  | { text?: never; tooLarge: true; invalidEncoding?: never }
  | { text?: never; tooLarge?: never; invalidEncoding: true };

export async function readTextWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<BodyResult> {
  if (!body) return { text: "" };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { invalidEncoding: true };
  }
}

// Reads a JSON object body, or returns the response the caller should send back.
export async function readJsonObject(
  request: Request,
  maxBytes: number,
  respond: Responder,
  tooLargeMessage: string
): Promise<{ value: Record<string, unknown>; error?: never } | { value?: never; error: Response }> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return { error: respond({ error: "只接受 JSON" }, 415) };
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { error: respond({ error: tooLargeMessage }, 413) };
  }
  const body = await readTextWithLimit(request.body, maxBytes);
  if (body.tooLarge) return { error: respond({ error: tooLargeMessage }, 413) };
  if (body.invalidEncoding) return { error: respond({ error: "請提供 UTF-8 格式的 JSON" }, 400) };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return { error: respond({ error: "請提供有效的 JSON" }, 400) };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: respond({ error: "資料格式錯誤" }, 400) };
  }
  return { value: parsed as Record<string, unknown> };
}

export function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

// Coarse per-network bucket. The raw address never reaches storage or logs.
export async function networkKeyFor(request: Request, salt: string): Promise<string> {
  const address = request.headers.get("CF-Connecting-IP") || "unknown";
  return (await sha256Hex(`${salt}:${address}`)).slice(0, 32);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}
