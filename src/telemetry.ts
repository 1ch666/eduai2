import type {TraceContext} from './trace-context';
// HTTP-boundary telemetry. Never derive identifiers from credentials or
// serialize Request, Response, exception messages, bodies, or URL query strings.
const STATIC_ENDPOINTS = new Set([
  '/api/capabilities', '/api/messages', '/api/progress',
  ...['session','register','login','logout','recover','first-recovery'].map(x=>`/api/auth/${x}`),
  ...['status','ask'].map(x=>`/api/ai/${x}`),
  ...['cases','cases/generate','sessions'].map(x=>`/api/court/${x}`),
  ...['questions','answer','weakness','reinforce'].map(x=>`/api/practice/${x}`),
  ...['slots','focus/start','focus/beat','focus/end'].map(x=>`/api/planner/${x}`),
  ...['vapid-key','subscribe','unsubscribe'].map(x=>`/api/push/${x}`),
  ...['top','me','join','leave'].map(x=>`/api/rankings/${x}`),
  ...['status','explain'].map(x=>`/api/photo/${x}`),
  '/api/groups', '/api/groups/join'
]);
const ID = '[0-9a-f-]{36}';
const ROUTES: ReadonlyArray<readonly [RegExp, string]> = [
  [new RegExp(`^/api/court/v1/sessions/${ID}$`, 'i'), '/api/court/v1/sessions/:sessionId'],
  [new RegExp(`^/api/court/v1/sessions/${ID}/actions$`, 'i'), '/api/court/v1/sessions/:sessionId/actions'],
  [new RegExp(`^/api/court/v1/sessions/${ID}/requests/${ID}$`, 'i'), '/api/court/v1/sessions/:sessionId/requests/:requestId'],
  [new RegExp(`^/api/court/sessions/${ID}$`), '/api/court/sessions/:sessionId'],
  ...['events','delete','actions','dialogue'].map(suffix =>
    [new RegExp(`^/api/court/sessions/${ID}/${suffix}$`), `/api/court/sessions/:sessionId/${suffix}`] as const),
  [new RegExp(`^/api/court/sessions/${ID}/npcs/[A-Za-z]+/messages$`), '/api/court/sessions/:sessionId/npcs/:npcId/messages'],
  [new RegExp(`^/api/planner/slots/${ID}$`), '/api/planner/slots/:slotId'],
  [new RegExp(`^/api/groups/${ID}$`), '/api/groups/:groupId'],
  ...['leave','invite','leaderboard'].map(suffix =>
    [new RegExp(`^/api/groups/${ID}/${suffix}$`), `/api/groups/:groupId/${suffix}`] as const),
  [new RegExp(`^/api/groups/${ID}/invite/[0-9A-F]{8}$`), '/api/groups/:groupId/invite/:code'],
  [new RegExp(`^/api/groups/${ID}/members/${ID}$`), '/api/groups/:groupId/members/:userId']
];

export function telemetryEndpoint(pathname: string): string {
  if (STATIC_ENDPOINTS.has(pathname)) return pathname;
  return ROUTES.find(([pattern])=>pattern.test(pathname))?.[1] ?? '/api/:unmatched';
}

export interface HttpTraceRecord {
  schemaVersion: 1;
  event: 'http.request.completed';
  requestId: string;
  traceId: string;
  timestamp: string;
  // Deliberately unavailable at this boundary; do not hash a Cookie or user ID.
  safeSessionId: null;
  endpoint: string;
  method: string;
  latencyMs: number;
  status: number;
  // Transport classification, NOT a guessed domain error or AI availability.
  errorCode: string | null;
}

/** One independent context per HTTP attempt, not a mutation/idempotency key.
 * The server ignores caller-supplied X-Request-ID / traceparent to prevent
 * spoofed correlations. Domain request IDs remain untouched in JSON bodies.
 */
export async function observeApiRequest(
  request: Request,
  operation: (trace:TraceContext) => Promise<Response>,
  failureResponse: () => Response,
  emit: (record: HttpTraceRecord) => void = record => console.log(JSON.stringify(record))
): Promise<Response> {
  const started = performance.now();
  const requestId = crypto.randomUUID();
  const traceId = crypto.randomUUID().replaceAll('-', '');
  const endpoint = telemetryEndpoint(new URL(request.url).pathname);
  const method = ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(request.method) ? request.method : 'OTHER';
  let response: Response;
  let failed = false;
  try { response = await operation({schemaVersion:1,requestId,traceId}); }
  catch { failed = true; response = failureResponse(); }

  const headers = new Headers(response.headers);
  headers.set('X-Request-ID', requestId);
  headers.set('X-Trace-ID', traceId);
  // Preserve credentialed CORS and any pre-existing exposed headers.
  if (headers.has('Access-Control-Allow-Origin')) {
    const exposed = headers.get('Access-Control-Expose-Headers');
    headers.set('Access-Control-Expose-Headers', [exposed, 'X-Request-ID', 'X-Trace-ID'].filter(Boolean).join(', '));
  }
  const result = new Response(response.body, {status: response.status, statusText: response.statusText, headers});
  const elapsed = performance.now() - started;
  const record: HttpTraceRecord = {
    schemaVersion: 1, event: 'http.request.completed', requestId, traceId,
    timestamp: new Date().toISOString(), safeSessionId: null, endpoint, method,
    latencyMs: Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : 0,
    status: response.status,
    errorCode: failed ? 'INTERNAL_ERROR' : response.status >= 400 ? `HTTP_${response.status}` : null
  };
  // A telemetry sink outage must never make an already-committed action fail.
  try { emit(record); } catch { /* fail open for telemetry, never for auth */ }
  return result;
}
