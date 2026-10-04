# Account crypto interleavings — candidate

Scope: existing AccountStore, no new authentication system, account database,
schema, secrets, permissions or password algorithm. Tests use synthetic Node
SQLite accounts and mocked DO lifecycle; they do not touch production.

The first-recovery method checked code absence, then awaited code hashing before
inserting. Forced concurrent requests both observed absence; one then threw a
unique-key SQL error instead of returning the documented ALREADY_EXISTS result.
The fix computes the digest first, then rechecks current credential hash/salt/
iterations and code absence immediately before the synchronous insert. No await
is allowed between those checks and insert. No existing code is overwritten.

`scripts/test-account-races.mjs` gates real Web Crypto promises, not sleeps:

- two first-recovery requests: one code, one ALREADY_EXISTS, no SQL exception;
- login paused in PBKDF2 while recovery commits: old credentials cannot log in;
- login paused in session-token SHA-256 while recovery commits: no old session;
- first-recovery credentials changed while hashing: reject, no code inserted;
- two uses of the same recovery code: one reset, old sessions revoked, progress
  retained, only the winner's next code digest persisted.

The login/recovery defenses already existed; these tests supply missing forced
interleaving evidence. This is not a password-version migration, browser two-tab
test, live production reset or full account backup/restore validation.

Compatibility: existing response contracts and one-use code behavior preserved;
the concurrent loser now receives a controlled conflict instead of HTTP 500.
Code-only rollback is possible without database conversion but restores the race.
No production deployment claimed yet. Run `node --test scripts/test-account-races.mjs`.
All five race groups and full local `node scripts/ci-fast.mjs` passed on
2026-10-04. Remote CI/workerd acceptance and production release are still pending.
