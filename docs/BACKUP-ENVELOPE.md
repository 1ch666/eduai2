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

Design reference: https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams
