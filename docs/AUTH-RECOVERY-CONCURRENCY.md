# Account recovery concurrency regression

The existing local-only `scripts/check-api.mjs` now exercises recovery through
the real Worker, AccountStore and local SQLite, rather than mocked storage.
It reuses its disposable synthetic account and never targets production.

Assertions added:

- Two simultaneous uses of the same recovery code, requesting different new
  passwords, yield exactly one 200 and one 401, without assuming the winner.
- Recovery rotates the cookie and one-use recovery code; the original session
  cannot resolve an account or read progress afterward.
- Replaying the consumed code and logging in with the losing password fail.
- Login with the current password races another recovery. Login may win first
  or be rejected; after both finish, no old-password session remains valid.
- The final password works and existing progress survives both resets.
- A caller-supplied fixed cookie cannot choose the newly issued session token.

Requests launch with Promise.all, without sleep-based ordering. The test asserts
persisted outcomes after both responses, not merely response status during the
race. It does not force every possible async-crypto scheduling interleaving, prove
arbitrary-load safety, or replace browser tests of Secure/SameSite cookie behavior.
Local HTTP intentionally uses the non-__Host development cookie. Existing unit
tests and production cookie review are separate evidence.

Local verification passed on 2026-09-28 with Wrangler 4.136.3:

```text
node scripts/check-api.mjs http://127.0.0.1:8798
```

The fast CI local-api job already runs this script with AI disabled and disposable
storage. No runtime source, database schema, migration, credentials, formal
account, deployment configuration or Unity asset changed. No redeployment is
needed for this test-only change. Passwords/codes/cookies stay in test memory and
are not printed in normal success output or uploaded as artifacts.
