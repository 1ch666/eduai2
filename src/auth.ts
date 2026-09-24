// Account and progress routes. Everything here is cookie based: the browser
// gets an HttpOnly session cookie, and every state change also needs the CSRF
// token that only a trusted origin can read back from /api/auth/session.
import { networkKeyFor, readJsonObject, sha256Hex, type Responder } from "./http";
import { accountStore, clearedSessionCookie, csrfTokenMatches, readSessionToken, resolveSession, sessionCookie } from "./session";
import { PROGRESS_SCOPES, type AuthResult } from "./accounts";
import type { AppEnv } from "./env";

const MAX_AUTH_BODY_BYTES = 2048;
const MAX_PROGRESS_BODY_BYTES = 10_240;

const AUTH_ERROR_TEXT: Record<string, { status: number; message: string }> = {
  INVALID_USERNAME: { status: 400, message: "帳號需為 3 至 24 個英文小寫字母、數字或底線" },
  INVALID_DISPLAY_NAME: { status: 400, message: "顯示名稱需為 1 至 24 個字" },
  INVALID_PASSWORD: { status: 400, message: "密碼需為 8 至 128 個字，且不能包含帳號名稱" },
  USERNAME_TAKEN: { status: 409, message: "這個帳號已經有人使用" },
  BAD_CREDENTIALS: { status: 401, message: "帳號或密碼不正確" },
  RATE_LIMIT: { status: 429, message: "嘗試次數過多，請五分鐘後再試" }
};

function authFailure(result: Extract<AuthResult, { ok: false }>, respond: Responder): Response {
  const mapped = AUTH_ERROR_TEXT[result.error] ?? { status: 400, message: "資料格式錯誤" };
  return respond({ error: mapped.message, code: result.error }, mapped.status);
}

function authSuccess(request: Request, result: Extract<AuthResult, { ok: true }>, respond: Responder, status: number): Response {
  return respond(
    { user: result.user, csrfToken: result.csrfToken, expiresAt: result.expiresAt, recoveryCode: result.recoveryCode },
    status,
    [sessionCookie(request, result.token, result.expiresAt)]
  );
}

export async function handleAuth(
  request: Request,
  env: AppEnv,
  respond: Responder,
  trustedOrigin: string | undefined
): Promise<Response> {
  const url = new URL(request.url);
  const action = url.pathname.slice("/api/auth/".length);

  if (action === "session") {
    if (request.method !== "GET") return respond({ error: "此端點只接受 GET" }, 405);
    const session = await resolveSession(request, env);
    if (!session) return respond({ user: null });
    return respond({ user: session.user, csrfToken: session.csrfToken, expiresAt: session.expiresAt, hasRecoveryCode: session.hasRecoveryCode });
  }

  if (request.method !== "POST") return respond({ error: "此端點只接受 POST" }, 405);
  if (!trustedOrigin) return respond({ error: "拒絕未授權網站寫入" }, 403);

  if (action === "logout") {
    const token = readSessionToken(request);
    if (token) {
      const session = await resolveSession(request, env);
      // A live session must prove CSRF; an unknown cookie is simply cleared.
      if (session && !csrfTokenMatches(request, session)) return respond({ error: "請重新整理頁面後再登出" }, 403);
      await accountStore(env).logout(await sha256Hex(token));
    }
    return respond({ user: null }, 200, [clearedSessionCookie(request)]);
  }

  if (!["register", "login", "recover", "first-recovery"].includes(action)) return respond({ error: "找不到 API" }, 404);

  const body = await readJsonObject(request, MAX_AUTH_BODY_BYTES, respond, "登入資料過長");
  if (body.error) return body.error;
  const candidate = body.value;
  if (typeof candidate.username !== "string" || typeof candidate.password !== "string") {
    return respond({ error: "請填寫帳號與密碼" }, 400);
  }
  const networkKey = await networkKeyFor(request, "civic-law-auth");
  const store = accountStore(env);

  if (action === "recover") {
    if (typeof candidate.recoveryCode !== "string") return respond({ error: "請提供復原碼" }, 400);
    const result = await store.recover({ username: candidate.username, password: candidate.password, recoveryCode: candidate.recoveryCode, networkKey });
    return result.ok ? authSuccess(request, result, respond, 200) : authFailure(result, respond);
  }

  if (action === "first-recovery") {
    const session = await resolveSession(request, env);
    if (!session) return respond({ error: "請先登入才能取得復原碼" }, 401);
    if (!csrfTokenMatches(request, session)) return respond({ error: "請重新整理頁面後再試" }, 403);
    if (typeof candidate.password !== "string") return respond({ error: "請提供目前密碼以確認身分" }, 400);
    const result = await store.firstRecovery({ userId: session.user.id, password: candidate.password, networkKey });
    if (!result.ok) {
      if (result.error === "ALREADY_EXISTS") return respond({ error: "此帳號已有復原碼。若需更新，請使用「以復原碼重設密碼」流程；若已遺失則無法重設密碼。" }, 409);
      if (result.error === "RATE_LIMIT") return authFailure({ ok: false, error: "RATE_LIMIT" }, respond);
      return authFailure({ ok: false, error: "BAD_CREDENTIALS" }, respond);
    }
    return respond({ recoveryCode: result.recoveryCode });
  }

  if (action === "register") {
    const displayName = typeof candidate.displayName === "string" ? candidate.displayName : "";
    const result = await store.register({
      username: candidate.username,
      password: candidate.password,
      displayName,
      networkKey
    });
    if (!result.ok) return authFailure(result, respond);
    return authSuccess(request, result, respond, 201);
  }

  const result = await store.login({ username: candidate.username, password: candidate.password, networkKey });
  if (!result.ok) return authFailure(result, respond);
  return authSuccess(request, result, respond, 200);
}

export async function handleProgress(
  request: Request,
  env: AppEnv,
  respond: Responder,
  trustedOrigin: string | undefined
): Promise<Response> {
  const session = await resolveSession(request, env);
  if (!session) return respond({ error: "請先登入才能同步學習進度" }, 401);
  const store = accountStore(env);

  if (request.method === "GET") {
    const records = (await store.progress(session.user.id)).flatMap(record => {
      try {
        return [{
          scope: record.scope,
          payload: JSON.parse(record.payloadJson) as unknown,
          selfReported: record.selfReported,
          updatedAt: record.updatedAt
        }];
      } catch {
        return [];
      }
    });
    return respond({ user: session.user, records });
  }
  if (request.method !== "PUT") return respond({ error: "此端點只接受 GET 或 PUT" }, 405);
  if (!trustedOrigin) return respond({ error: "拒絕未授權網站寫入" }, 403);
  if (!csrfTokenMatches(request, session)) return respond({ error: "請重新整理頁面後再儲存" }, 403);

  const body = await readJsonObject(request, MAX_PROGRESS_BODY_BYTES, respond, "進度資料過長");
  if (body.error) return body.error;
  const candidate = body.value;
  if (typeof candidate.scope !== "string" || !(PROGRESS_SCOPES as readonly string[]).includes(candidate.scope)) {
    return respond({ error: `進度分類需為 ${PROGRESS_SCOPES.join("、")}` }, 400);
  }
  const payloadJson = JSON.stringify(candidate.payload ?? null);
  const result = await store.saveProgress(session.user.id, candidate.scope, payloadJson);
  if (result.error === "PAYLOAD_TOO_LARGE") return respond({ error: "進度資料過長" }, 413);
  if (result.error || !result.record) return respond({ error: "進度分類錯誤" }, 400);
  // Client-reported only: this is a personal study log, never a graded score.
  return respond({
    record: {
      scope: result.record.scope,
      payload: candidate.payload ?? null,
      selfReported: result.record.selfReported,
      updatedAt: result.record.updatedAt
    }
  });
}
