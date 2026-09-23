// Worker entry point: static assets plus the /api surface for the study site
// and the Unity courtroom build. Route handlers live in their own modules.
import { json, responseHeaders, TRUSTED_WEB_ORIGINS, type Responder } from "./http";
import { handleAuth, handleProgress } from "./auth";
import { handleAiRequest } from "./ai";
import { handleMessages } from "./messages";
import type { AppEnv } from "./env";
import { handleCourt } from './court';
export { CourtRoom, Learner } from './court';

export { MessageRoom } from "./messages";
export { AccountStore } from "./accounts";

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN"
};

function isApiPath(pathname: string): boolean {
  return (
    pathname === '/api/capabilities' || pathname.startsWith('/api/court/') ||
    pathname === "/api/messages" ||
    pathname === "/api/progress" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/ai/status" ||
    pathname === "/api/ai/ask"
  );
}

async function handleApi(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const requestOrigin = request.headers.get("Origin") || "";
  const trustedOrigin = TRUSTED_WEB_ORIGINS.has(requestOrigin) || requestOrigin === url.origin ? requestOrigin : undefined;
  const respond: Responder = (data, status = 200, cookies = []) => json(data, status, trustedOrigin, cookies);
  if (!isApiPath(url.pathname)) return respond({ error: "找不到 API" }, 404);

  if (request.method === "OPTIONS") {
    if (!trustedOrigin) return respond({ error: "拒絕未授權網站" }, 403);
    return new Response(null, { status: 204, headers: responseHeaders(trustedOrigin) });
  }

  if (url.pathname === '/api/capabilities') {
    if (request.method !== 'GET') return respond({error:'此端點只接受 GET'},405);
    return respond({version:'platform-1-preview',auth:true,recovery:true,court:true,courtStatus:'preview',courtAi:env.COURT_AI_ENABLED==='true'&&Boolean(env.OLLAMA_API_KEY),textAi:Boolean(env.OLLAMA_API_KEY),photo:false,push:false,planner:false,rankings:false});
  }
  if (url.pathname.startsWith('/api/court/')) return handleCourt(request,env,respond,trustedOrigin);

  if (url.pathname.startsWith("/api/auth/")) return await handleAuth(request, env, respond, trustedOrigin);
  if (url.pathname === "/api/progress") return await handleProgress(request, env, respond, trustedOrigin);
  if (url.pathname.startsWith("/api/ai/")) {
    // The Unity build and the site both post here; reads stay open for status.
    if (!trustedOrigin && request.method !== "GET") return respond({ error: "拒絕未授權網站寫入" }, 403);
    return await handleAiRequest(request, env, respond);
  }
  return await handleMessages(request, env, respond, trustedOrigin);
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    } catch (error) {
      console.error(JSON.stringify({
        message: "request failed",
        method: request.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error)
      }));
      return json({ error: "服務暫時無法使用" }, 500);
    }
  }
} satisfies ExportedHandler<AppEnv>;

