import type { Practice } from './practice';
import type { Planner } from './planner';
import type { PushStore } from './push';
// Worker bindings plus the values that only exist as secrets or vars.
// Secrets are set with `wrangler secret put` and never committed.
export type AppEnv = Env & {
  PRACTICE: DurableObjectNamespace<Practice>;
  PLANNER: DurableObjectNamespace<Planner>;
  PUSH_STORE: DurableObjectNamespace<PushStore>;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_MODEL?: string;
  /** Explicit release gate: enable only after checking this model's free quota. */
  COURT_AI_ENABLED?: string;
  /** PBKDF2 rounds for new passwords. Do not reduce merely to fit a quota. */
  PASSWORD_ITERATIONS?: string;
  /** Idle session lifetime in days (default 14, capped at 30). */
  SESSION_TTL_DAYS?: string;
};
