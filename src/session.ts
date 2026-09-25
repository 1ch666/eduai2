// Session plumbing for the Worker edge: cookie shape, lookup and CSRF checks.
// The browser never sees the stored digest and scripts never read the token,
// so the cookie stays HttpOnly and nothing is mirrored into localStorage.
import { sha256Hex, timingSafeEqual } from "./http";
import type { AccountStore, SessionInfo } from "./accounts";
import type { AppEnv } from "./env";

const SECURE_COOKIE_NAME = "__Host-civic_session";
const PLAIN_COOKIE_NAME = "civic_session";
export const ACCOUNT_STORE_NAME = "civic-accounts-main";

export function accountStore(env: AppEnv): DurableObjectStub<AccountStore> {
  // Wrangler generates the namespace without its RPC generic; narrow it here.
  return env.ACCOUNT_STORE.getByName(ACCOUNT_STORE_NAME) as DurableObjectStub<AccountStore>;
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

function cookieName(request: Request): string {
  return isSecureRequest(request) ? SECURE_COOKIE_NAME : PLAIN_COOKIE_NAME;
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== cookieName(request)) continue;
    const value = part.slice(separator + 1).trim();
    if (/^[0-9a-f]{64}$/.test(value)) return value;
  }
  return null;
}

/**
 * The full platform is same-origin on the Worker. Pages is a public entry.
 * Lax avoids reliance on third-party cookies; Origin + CSRF still guard writes.
 */
export function sessionCookie(request: Request, token: string, expiresAt: string): string {
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  const attributes = [`${cookieName(request)}=${token}`, "Path=/", "HttpOnly", `Max-Age=${maxAge}`];
  // SameSite=None is required for cross-site credentialed fetch:
  // GitHub Pages (github.io) → Worker (workers.dev) are different origins.
  // SameSite=Lax blocks cookies in cross-site fetch, breaking login on Pages.
  if (isSecureRequest(request)) attributes.push("Secure", "SameSite=None");
  else attributes.push("SameSite=Lax");
  return attributes.join("; ");
}

export function clearedSessionCookie(request: Request): string {
  const attributes = [`${cookieName(request)}=`, "Path=/", "HttpOnly", "Max-Age=0"];
  if (isSecureRequest(request)) attributes.push("Secure", "SameSite=None");
  else attributes.push("SameSite=Lax");
  return attributes.join("; ");
}

export async function resolveSession(request: Request, env: AppEnv): Promise<SessionInfo | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  return await accountStore(env).session(await sha256Hex(token));
}

/**
 * Double submit check. The token is handed out by /api/auth/session, which only
 * a trusted origin can read, so a cross-site form post cannot guess it.
 */
export function csrfTokenMatches(request: Request, session: SessionInfo): boolean {
  const header = request.headers.get("X-CSRF-Token") || "";
  return header.length > 0 && timingSafeEqual(header, session.csrfToken);
}
