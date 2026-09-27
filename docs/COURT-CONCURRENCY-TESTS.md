# Court HTTP concurrency regression

`scripts/check-court-v1-api.mjs` runs against disposable local workerd and
SQLite Durable Objects only. Its target guard rejects production URLs. AI is
disabled in the existing `Fast regression checks` local-api job.

Three additional scenarios launch requests with `Promise.all`, without sleeps:

1. Four identical initial commands: all return the identical stored event.
2. Two distinct commands with the same expected version: exactly one succeeds,
   the other returns 409. The test does not assume which request wins.
3. Two different request IDs reuse an idempotency key: exactly one succeeds,
   the other returns 409.

Each scenario creates a separate temporary session. Assertions check response
schemas, successful request-result recovery, snapshot version exactly 1, exactly
two journal events (initial snapshot plus one mutation), event equality, and
cross-account denial. Temporary sessions are deleted through the owner API.
No production account, session, migration, Secret or model request is involved.

Local verification on 2026-09-28 passed with Wrangler 4.136.3:

```text
node scripts/check-court-v1-api.mjs http://127.0.0.1:8798
```

The existing CI runs this same script, so no workflow change is necessary.
This is concurrent HTTP submission evidence, not real browser-tab testing,
global load testing, forced coverage of every runtime interleaving, login/recovery
races, or live AI concurrency coverage. Those remain separate requirements.
The synchronous action commit is exercised; no runtime change was necessary.
Test-only changes require no Worker/Unity/Docker rebuild or production deployment.
