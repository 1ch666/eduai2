// Account store: one SQLite-backed Durable Object holding users, sessions and
// self-reported learning progress. Passwords are salted PBKDF2; session tokens
// are only ever stored as SHA-256 digests, so a storage dump cannot be replayed.
import { DurableObject } from "cloudflare:workers";
import { sha256Hex, timingSafeEqual, toHex } from "./http";
import type { AppEnv } from "./env";

export const PROGRESS_SCOPES = ["civics", "daily", "court", "game"] as const;
export type ProgressScope = (typeof PROGRESS_SCOPES)[number];

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
const MAX_PROGRESS_BYTES = 8192;
const DEFAULT_ITERATIONS = 100_000;
const MIN_ITERATIONS = 20_000;
const MAX_ITERATIONS = 400_000;
const DEFAULT_TTL_DAYS = 14;
const MAX_TTL_DAYS = 30;
const ABSOLUTE_SESSION_DAYS = 60;
const DAY_MS = 86_400_000;

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  role: "student";
  createdAt: string;
};

// payloadJson stays a JSON string end to end: Durable Object RPC only carries
// structured-clone friendly values, and a string keeps the contract explicit.
export type ProgressRecord = {
  scope: ProgressScope;
  payloadJson: string;
  /** Always true for now: the client reports it, so it is never a graded result. */
  selfReported: boolean;
  updatedAt: string;
};

export type SessionInfo = {
  user: PublicUser;
  csrfToken: string;
  expiresAt: string;
};

export type AuthError =
  | "INVALID_USERNAME"
  | "INVALID_DISPLAY_NAME"
  | "INVALID_PASSWORD"
  | "USERNAME_TAKEN"
  | "BAD_CREDENTIALS"
  | "RATE_LIMIT";

export type AuthResult =
  | { ok: true; user: PublicUser; token: string; csrfToken: string; expiresAt: string; recoveryCode?: string }
  | { ok: false; error: AuthError };

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  created_at: string;
};

type SessionRow = {
  token_hash: string;
  user_id: string;
  csrf_token: string;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
};

function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return toHex(buffer.buffer);
}

function stripControlCharacters(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

async function derivePasswordHash(password: string, saltHex: string, iterations: number): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], byte => parseInt(byte, 16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(bits);
}

export class AccountStore extends DurableObject<AppEnv> {
  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          password_iterations INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          last_login_at TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          csrf_token TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
        CREATE TABLE IF NOT EXISTS progress (
          user_id TEXT NOT NULL,
          scope TEXT NOT NULL,
          payload TEXT NOT NULL,
          self_reported INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, scope)
        );
        CREATE TABLE IF NOT EXISTS auth_limits (
          key TEXT PRIMARY KEY,
          window_start INTEGER NOT NULL,
          attempt_count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS recovery_codes (
          user_id TEXT PRIMARY KEY, code_hash TEXT NOT NULL
        );
      `);
    });
  }

  private get iterations(): number {
    const configured = Number(this.env.PASSWORD_ITERATIONS || DEFAULT_ITERATIONS);
    if (!Number.isFinite(configured)) return DEFAULT_ITERATIONS;
    return Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, Math.round(configured)));
  }

  private get sessionTtlMs(): number {
    const configured = Number(this.env.SESSION_TTL_DAYS || DEFAULT_TTL_DAYS);
    const days = Number.isFinite(configured) ? Math.min(MAX_TTL_DAYS, Math.max(1, Math.round(configured))) : DEFAULT_TTL_DAYS;
    return days * DAY_MS;
  }

  /** Fixed five minute window; returns false once a bucket is spent. */
  private allowAttempt(key: string, limit: number): boolean {
    const windowStart = Math.floor(Date.now() / 300_000) * 300_000;
    const row = this.ctx.storage.sql
      .exec<{ window_start: number; attempt_count: number }>("SELECT window_start, attempt_count FROM auth_limits WHERE key = ?", key)
      .toArray()[0];
    if (row?.window_start === windowStart && row.attempt_count >= limit) return false;
    this.ctx.storage.sql.exec(
      `INSERT INTO auth_limits (key, window_start, attempt_count)
       VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         window_start = excluded.window_start,
         attempt_count = CASE WHEN auth_limits.window_start = excluded.window_start THEN auth_limits.attempt_count + 1 ELSE 1 END`,
      key,
      windowStart
    );
    return true;
  }

  private purgeExpired(now: number): void {
    this.ctx.storage.sql.exec("DELETE FROM sessions WHERE expires_at < ?", now);
    this.ctx.storage.sql.exec("DELETE FROM auth_limits WHERE window_start < ?", now - 3_600_000);
  }

  private toPublicUser(row: UserRow): PublicUser {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: "student",
      createdAt: row.created_at
    };
  }

  private async issueSession(user: UserRow): Promise<AuthResult> {
    const now = Date.now();
    const token = randomToken();
    const csrfToken = randomToken(24);
      const expiresAt = now + this.sessionTtlMs;
      const tokenHash = await sha256Hex(token);
      // Recovery may run while crypto yields. Do not revive old credentials.
      const current = this.ctx.storage.sql.exec<UserRow>("SELECT * FROM users WHERE id = ?", user.id).toArray()[0];
      if (!current || current.password_hash !== user.password_hash || current.password_salt !== user.password_salt) {
        return { ok: false, error: "BAD_CREDENTIALS" };
      }
    this.ctx.storage.sql.exec(
      "INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
        tokenHash,
      user.id,
      csrfToken,
      now,
      expiresAt,
      now
    );
    // Keep at most 10 live sessions per account so old devices drop off.
    this.ctx.storage.sql.exec(
      `DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN (
         SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC LIMIT 10
       )`,
      user.id,
      user.id
    );
    this.ctx.storage.sql.exec("UPDATE users SET last_login_at = ? WHERE id = ?", new Date(now).toISOString(), user.id);
    return {
      ok: true,
      user: this.toPublicUser(user),
      token,
      csrfToken,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  async register(input: { username: string; displayName: string; password: string; networkKey: string }): Promise<AuthResult> {
    const username = String(input.username || "").trim().toLowerCase();
    const displayName = stripControlCharacters(String(input.displayName || "")) || username;
    const password = String(input.password || "");
    if (!USERNAME_PATTERN.test(username)) return { ok: false, error: "INVALID_USERNAME" };
    if (displayName.length < 1 || displayName.length > 24) return { ok: false, error: "INVALID_DISPLAY_NAME" };
    if (password.length < 8 || password.length > 128 || password.toLowerCase().includes(username)) {
      return { ok: false, error: "INVALID_PASSWORD" };
    }
    if (!this.allowAttempt(`register-network:${input.networkKey}`, 5)) return { ok: false, error: "RATE_LIMIT" };

    const now = Date.now();
    this.purgeExpired(now);
    const taken = this.ctx.storage.sql.exec<{ id: string }>("SELECT id FROM users WHERE username = ?", username).toArray()[0];
    if (taken) return { ok: false, error: "USERNAME_TAKEN" };

    const salt = randomToken(16);
    const iterations = this.iterations;
    const hash = await derivePasswordHash(password, salt, iterations);
    // Password derivation yields: another registration may take the name.
    if (this.ctx.storage.sql.exec("SELECT id FROM users WHERE username = ?", username).toArray().length) {
      return { ok: false, error: "USERNAME_TAKEN" };
    }
    const row: UserRow = {
      id: crypto.randomUUID(),
      username,
      display_name: displayName,
      password_hash: hash,
      password_salt: salt,
      password_iterations: iterations,
      created_at: new Date(now).toISOString()
    };
    this.ctx.storage.sql.exec(
      "INSERT INTO users (id, username, display_name, password_hash, password_salt, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      row.id,
      row.username,
      row.display_name,
      row.password_hash,
      row.password_salt,
      row.password_iterations,
      row.created_at
    );
    const recoveryCode = randomToken();
    this.ctx.storage.sql.exec("INSERT INTO recovery_codes VALUES (?, ?)", row.id, await sha256Hex(recoveryCode));
    const result = await this.issueSession(row);
    return result.ok ? { ...result, recoveryCode } : result;
  }

  /** One-use recovery; only the digest is persisted. A reset revokes every session. */
  async recover(input: { username: string; password: string; recoveryCode: string; networkKey: string }): Promise<AuthResult> {
    const username = String(input.username).trim().toLowerCase();
    if (!this.allowAttempt(`recover-network:${input.networkKey}`, 5) ||
        !this.allowAttempt(`recover-user:${username}`, 5)) return { ok: false, error: "RATE_LIMIT" };
    if (!USERNAME_PATTERN.test(username) || !/^[0-9a-f]{64}$/.test(input.recoveryCode)) return { ok: false, error: "BAD_CREDENTIALS" };
    if (input.password.length < 8 || input.password.length > 128 || input.password.toLowerCase().includes(username)) return { ok: false, error: "INVALID_PASSWORD" };
    const digest = await sha256Hex(input.recoveryCode);
    const salt = randomToken(16), iterations = this.iterations;
    const passwordHash = await derivePasswordHash(input.password, salt, iterations);
    const recoveryCode = randomToken(), nextDigest = await sha256Hex(recoveryCode);
    // Re-read after async crypto. Consumption and password reset are atomic.
    const row = this.ctx.storage.sql.exec<UserRow>("SELECT * FROM users WHERE username = ?", username).toArray()[0];
    const recovery = row && this.ctx.storage.sql.exec<{ code_hash: string }>("SELECT code_hash FROM recovery_codes WHERE user_id = ?", row.id).toArray()[0];
    if (!row || !recovery || !timingSafeEqual(digest, recovery.code_hash)) return { ok: false, error: "BAD_CREDENTIALS" };
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec("UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ? WHERE id = ?", passwordHash, salt, iterations, row.id);
      this.ctx.storage.sql.exec("UPDATE recovery_codes SET code_hash = ? WHERE user_id = ?", nextDigest, row.id);
        this.ctx.storage.sql.exec("DELETE FROM sessions WHERE user_id = ?", row.id);
      });
    const result = await this.issueSession({ ...row, password_hash: passwordHash, password_salt: salt, password_iterations: iterations });
    return result.ok ? { ...result, recoveryCode } : result;
  }

  async login(input: { username: string; password: string; networkKey: string }): Promise<AuthResult> {
    const username = String(input.username || "").trim().toLowerCase();
    const password = String(input.password || "");
    if (!USERNAME_PATTERN.test(username) || password.length < 8 || password.length > 128) {
      return { ok: false, error: "BAD_CREDENTIALS" };
    }
    if (!this.allowAttempt(`login-network:${input.networkKey}`, 30)) return { ok: false, error: "RATE_LIMIT" };
    if (!this.allowAttempt(`login-user:${username}`, 10)) return { ok: false, error: "RATE_LIMIT" };

    this.purgeExpired(Date.now());
    const row = this.ctx.storage.sql.exec<UserRow>("SELECT * FROM users WHERE username = ?", username).toArray()[0];
    if (!row) {
      // Spend comparable time on unknown accounts so timing does not reveal them.
      await derivePasswordHash(password, randomToken(16), this.iterations);
      return { ok: false, error: "BAD_CREDENTIALS" };
    }
    const hash = await derivePasswordHash(password, row.password_salt, row.password_iterations);
    if (!timingSafeEqual(hash, row.password_hash)) return { ok: false, error: "BAD_CREDENTIALS" };
    return await this.issueSession(row);
  }

  /** Resolves a cookie token digest, extending the idle window at most once a day. */
  async session(tokenHash: string): Promise<SessionInfo | null> {
    if (!/^[0-9a-f]{64}$/.test(tokenHash)) return null;
    const now = Date.now();
    const row = this.ctx.storage.sql
      .exec<SessionRow>("SELECT * FROM sessions WHERE token_hash = ?", tokenHash)
      .toArray()[0];
    if (!row) return null;
    if (row.expires_at < now || row.created_at + ABSOLUTE_SESSION_DAYS * DAY_MS < now) {
      this.ctx.storage.sql.exec("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
      return null;
    }
    const user = this.ctx.storage.sql.exec<UserRow>("SELECT * FROM users WHERE id = ?", row.user_id).toArray()[0];
    if (!user) {
      this.ctx.storage.sql.exec("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
      return null;
    }
    let expiresAt = row.expires_at;
    if (now - row.last_seen_at > DAY_MS) {
      expiresAt = Math.min(now + this.sessionTtlMs, row.created_at + ABSOLUTE_SESSION_DAYS * DAY_MS);
      this.ctx.storage.sql.exec("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?", now, expiresAt, tokenHash);
    }
    return { user: this.toPublicUser(user), csrfToken: row.csrf_token, expiresAt: new Date(expiresAt).toISOString() };
  }

  async logout(tokenHash: string): Promise<void> {
    if (!/^[0-9a-f]{64}$/.test(tokenHash)) return;
    this.ctx.storage.sql.exec("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
  }

  async progress(userId: string): Promise<ProgressRecord[]> {
    return this.ctx.storage.sql
      .exec<{ scope: string; payload: string; self_reported: number; updated_at: string }>(
        "SELECT scope, payload, self_reported, updated_at FROM progress WHERE user_id = ?",
        userId
      )
      .toArray()
      .map(row => ({
        scope: row.scope as ProgressScope,
        payloadJson: row.payload,
        selfReported: row.self_reported === 1,
        updatedAt: row.updated_at
      }));
  }

  /** Stores client-reported progress verbatim. Never treat it as a graded score. */
  async saveProgress(
    userId: string,
    scope: string,
    payloadJson: string
  ): Promise<{ record?: ProgressRecord; error?: "INVALID_SCOPE" | "PAYLOAD_TOO_LARGE" }> {
    if (!(PROGRESS_SCOPES as readonly string[]).includes(scope)) return { error: "INVALID_SCOPE" };
    const serialized = payloadJson;
    if (new TextEncoder().encode(serialized).byteLength > MAX_PROGRESS_BYTES) return { error: "PAYLOAD_TOO_LARGE" };
    const updatedAt = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `INSERT INTO progress (user_id, scope, payload, self_reported, updated_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(user_id, scope) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      userId,
      scope,
      serialized,
      updatedAt
    );
    return { record: { scope: scope as ProgressScope, payloadJson: serialized, selfReported: true, updatedAt } };
  }
}
