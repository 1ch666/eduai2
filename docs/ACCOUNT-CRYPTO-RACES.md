# Account crypto interleavings

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
Run `node --test scripts/test-account-races.mjs`.
All five race groups and full local `node scripts/ci-fast.mjs` passed on
2026-10-04.

## Release evidence — 2026-10-04

- Source: `f7125cee02411c01f885576e0edf3dc5bdf45572` on `main`.
- GitHub Actions run `37170303750`: both `checks` and `local-api` passed.
  The latter runs disposable workerd integration; the five forced crypto
  interleavings above remain Node SQLite evidence, not forced workerd races.
- Wrangler 4.136.3 dry-run passed, then deployment used `--keep-vars --strict`.
  Worker version: `0215495e-d5a6-47d8-b2dc-e67682683617`.
  Upload 491.48 KiB / gzip 112.20 KiB; reported startup 2 ms.
- Existing dashboard variables and secrets retained; no schema migration,
  account reset, data removal, permission change or static asset upload.
  The local provider difference was only the user's comments/whitespace;
  `redirect:'manual'` remains unchanged.
- Read-only production probes: `/api/capabilities`, `/api/court/cases` and
  `/api/auth/session` returned 200; an anonymous v2 court session request
  returned 401 with `apiVersion:2`, `ok:false` and a request ID matching its
  response header. These checks do not prove authenticated production recovery
  or simulate concurrent resets on real accounts; neither was attempted.
- Previous Worker version for code rollback:
  `d45202ae-a016-41c4-9d4b-00feecd22229`. No data conversion is needed, but
  rolling back reintroduces the first-recovery race described above.

Remaining account work includes password-version migration review, full account
backup/restore verification and browser/runtime-specific concurrency coverage.
This release does not complete the overall backend objective.
