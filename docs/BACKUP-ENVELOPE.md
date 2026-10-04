# Encrypted backup envelope v1

Status: implemented cryptographic building block, not a production backup or restore service.
Contract: `contracts/backup-envelope-v1.schema.json`. Implementation: `src/backup-envelope.ts`.

`sealBackup` accepts bounded plaintext bytes, a caller-supplied nonextractable
AES-256-GCM CryptoKey and metadata. It uses a fresh random 96-bit IV and a 128-bit
authentication tag. Domain-separated canonical metadata is authenticated as AAD.
Metadata is public: never put a user name, session token or other private value in
archiveId, keyId or the other metadata fields. Plaintext is limited to 4 MiB;
larger exports need a separately specified chunked archive protocol, not truncation.

`openBackup` requires the complete expected metadata from an independently trusted
manifest. Do not obtain expected metadata from the archive being opened. Canonical
framing, exact fields, byte limits and canonical base64 are enforced. Wrong keys,
modified metadata/ciphertext and substitution of a different valid archive fail
with the same fixed error, without logging decrypted data. Decryption does not
establish ownership, domain validity, completeness or permission to restore.

The helper does not fetch data, export keys, persist files, expose an endpoint,
modify a database or invoke an AI provider. It is not wired into production routes.
The accounts/progress/experiments kind values reserve envelope types only; they
do not imply those domains have implemented backup exporters.

## Verification

Run `node --test scripts/test-backup-envelope.mjs` and TypeScript typecheck.
Tests use ephemeral synthetic keys/data and cover randomized encryption, tampering,
wrong keys, substitution, framing, malformed encodings, exact 4 MiB boundary,
metadata getters and mutation, and a synthetic CourtState round trip followed by
the identity-bound private state validator. Authenticated but invalid domain state
is rejected. This is NOT an isolated database restore drill.

## Required operator workflow before production use

1. Establish an approved external key store and tested recovery/rotation process.
   Nonextractable runtime keys do not themselves provide key durability or escrow.
   Losing the underlying key makes its archives unrecoverable. Never commit keys,
   plaintext backups, passwords, session material or recovery secrets to Git.
2. Export a consistent versioned snapshot of every required table and domain;
   include events, request receipts and deletion guards, not only live CourtState.
   Record a trusted manifest with archive ID, domain, time, actual source commit,
   schema and key reference independently from the encrypted archive.
3. Encrypt and store under restricted access, with retention/deletion and key-use
   limits. Random IVs are not a replacement for bounded key usage and rotation.
4. Authenticate/decrypt, then validate domain schemas, ownership and cross-table
   references before writing to a fresh isolated database. Never restore directly
   over live data, resurrect deleted sessions or assume old sessions remain valid.
5. Verify row counts, event reconstruction, idempotency, identity isolation and
   functional behavior in isolation. Record the evidence and approved recovery
   point before any separately authorized production recovery.

Export authorization, consistent multi-table/domain manifests, durable key custody,
retention, archive transport, transactional database import and disaster-recovery
drills remain unfinished. No production recovery readiness claim is made.
JavaScript/WebCrypto memory is not guaranteed securely erased by this helper.

## Isolated SQLite drill (2026-09-28)

`node --test scripts/test-court-journal.mjs` now exercises a synthetic court's
12-table snapshot through encryption/decryption into a second in-memory SQLite
database initialized by the actual CourtRoom constructor. A fixed table inventory
assertion detects new tables omitted from this drill. The test injects an import
failure and verifies transaction rollback, then verifies exact restored rows,
private reconstruction at every recorded version, public state/events, owner
isolation, command/NPC receipt retries without additional writes, stale rejection,
deletion cleanup and the anti-resurrection guard. The source database is unchanged.

This extends the byte-level test but uses a mocked Durable Object lifecycle with
real Node SQLite, not workerd or Cloudflare recovery. Only active, settled synthetic
court data is transferred; pending-provider recovery, deleted-backup import,
cross-domain consistency and accounts/progress/experiments are not covered.
The importer is intentionally test-local and accepts only harness-generated rows.
It is not an approved import API or a validator for arbitrary decrypted archives.
No production backup was read, created or restored by this drill.

## Isolated account/progress drill (2026-10-04)

`node --test scripts/test-account-restore.mjs` uses the actual AccountStore
constructor and methods with real in-memory Node SQLite and a mocked DO lifecycle.
It inventories all five current tables so a future schema addition fails the test
until its restore policy is reviewed. Two synthetic users and all four progress
scopes are encrypted/decrypted into a separate empty database.

Policy exercised: preserve `users`, `recovery_codes`, `progress`, `auth_limits`;
exclude `sessions` **before encryption**. Restored users must authenticate again.
Neither raw passwords, tokens, recovery secrets nor CSRF tokens are exported.
Password/recovery digests remain sensitive and require the encrypted access controls
above. User IDs remain stable for references from other domains.

Verified: injected mid-import failure rolls back every row; restored persistent
rows match the source; old sessions are invalid; fresh password login works;
one-use recovery works and revokes the fresh session; old password/code reuse is
rejected; both users' self-reported progress remains intact; populated destinations
are refused; the source is unchanged. Cross-user progress lookup checks use trusted
internal IDs, not HTTP authorization, and do not replace IDOR endpoint tests.

This is a **test-local fixture importer**, not an arbitrary archive validator or
production recovery tool. No production binding, schema, account, secret or file
is read or changed. It does not cover account rollback across password changes,
deleted-user resurrection, cross-domain recovery consistency, key custody,
pagination beyond 4 MiB, live exports or Cloudflare/workerd restore. Those remain
release gates before an operator-facing backup/restore service can be enabled.
In particular, do not restore an older recovery-code digest over a live account:
doing so could revive a consumed code. A separately approved recovery point and
credential invalidation policy are necessary before any production recovery.

## Account domain format and validation

`contracts/account-backup-v1.schema.json` specifies the private payload layout;
`src/account-backup.ts` validates decrypted UTF-8 bytes before the isolated drill's
import transaction. It has no network, database writes or production route.
Its only success output is a detached parsed archive, never an authorization.

Version 1 requires JSON.stringify framing (no extra whitespace, duplicate keys or
alternate escape forms), exact fields/tables and `sessionPolicy: reauthenticate`.
All five storage tables have an explicit policy: four included, sessions excluded.
Validation enforces a 4 MiB byte cap, bounded row counts, credential digest/salt
shapes and iteration bounds, unique IDs/usernames/recovery/progress/limit keys,
existing account references, valid ISO dates and login ordering, valid bounded
JSON progress with `self_reported:1`, and fixed-window rate-limit row shapes.
Missing first-recovery rows are allowed for legacy accounts. Unknown fields fail
closed so a future credential/schema version needs an explicit contract upgrade.
Machine schema covers structure; the runtime validator additionally checks
cross-row relations, byte lengths and actual date/JSON validity.

The full restore drill now uses this validator after decryption. Negative tests
cover corruption, orphan/duplicate rows, old sessions, credential fields, framing,
invalid UTF-8, byte limits and self-reported score integrity. It cannot establish
snapshot completeness, source authenticity by itself, age/freshness of credentials
or absence of changes after export. Authenticated encryption and independently
approved manifests/recovery points remain mandatory. No exporter or production
restore endpoint is enabled by this module.

## Offline account archive verification command

Requires Node 24 (the CI runtime). On an approved operator machine:

```text
node scripts/check-account-backup.mjs <encrypted-archive> <trusted-manifest> <32-byte-key-file>
```

The three arguments are file paths, never literal secrets. The key file contains
exactly 32 raw binary bytes, not a password, hex string or JSON. Use an existing
approved key export under restricted filesystem access, outside the repository
and all served asset directories; do not generate a replacement key for an old
archive. Key custody/escrow and permissions remain operator responsibilities.
Never commit or upload a real key or decrypted archive. This command does not
read environment credentials, contact any service or change database/files.

Supply the complete envelope metadata as a separate trusted JSON manifest;
do not manufacture it from the untrusted archive. The verifier checks its exact
binding with authenticated encryption and requires the accounts domain. It cannot
itself prove the operator obtained this manifest from a trusted channel.

Success prints only `ok`, verification scope, schema version, reauthentication
policy, table row counts and `restored:false`. Counts can still be operationally
sensitive; keep results private. No account IDs, usernames, payloads, key bytes,
digests or source paths are printed. Failure exits 1 with a fixed message. Files
are read with byte bounds; directories and oversized inputs are rejected. Byte
buffers are cleared best-effort, but JavaScript strings and key memory have no
guaranteed secure-erasure semantics.

`scripts/test-account-backup-cli.mjs` uses disposable synthetic files and keys,
verifies the actual command's exit codes/output, unchanged input bytes, wrong-key
and wrong-manifest rejection, key sizes, invalid decrypted payload, directories
and oversized archives. No real archive or key has been inspected in this work.
Passing means cryptographic/domain validity only: not a complete/fresh snapshot,
permission to restore, account lifecycle consistency or a production recovery.

Design reference: https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams
