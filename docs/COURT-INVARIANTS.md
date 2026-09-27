# Deterministic transition property checks

`scripts/test-court-invariants.mjs` imports the real `src/court-rules.ts`
transition function. For 16 fixed xorshift32 seeds, every built-in template and
supported role receives 80 mixed valid/invalid/stale commands. It asserts:

- Accepted transitions leave the input untouched and produce exactly one safe
  integer version increment, no backwards/skipped stage and no owner/config change.
- Reviewed evidence remains unique, valid and monotonic; closing evidence requires
  complete review and, for judges, both correct procedural rulings.
- Only answer actions increment attempts; terminal states expose no allowed actions.
- Identical state/action yields identical domain data (wall-clock updatedAt is
  excluded). Reapplying an old command to the new state is rejected as stale.
- Rejected commands cannot partially mutate input. The suite requires actual
  coverage of all six stages and all seven valid action types, not only rejections.

The boundary test initially failed: transition could increment MAX_SAFE_INTEGER
to an inexact/unrepresentable protocol version, or overflow answer attempts.
It now rejects exhausted/negative/fractional/nonfinite state versions, and rejects
such attempt counters before answering. MAX_SAFE_INTEGER-1 still increments to
MAX_SAFE_INTEGER; further transitions fail closed, without silently resetting data.
Normal records and public DTOs are unchanged; no migration is required.

Reproduce with `node --test scripts/test-court-invariants.mjs scripts/test-court.mjs`.
Both suites and TypeScript passed locally after the fix. The mixed generator was
also improved after its coverage assertion caught correlated random choices that
never reached valid closeEvidence/answer; separate draws now cover those actions.

Scope limitations: this tests the deterministic transition function, not HTTP
idempotency, DO concurrency, NPC-only version increments, generated-case validator
coverage, owner authorization or exact replay of wall-clock timestamps. Existing
isolated workerd tests cover separate auth/idempotency/recovery cases; neither is
a claim of universal fuzz coverage or a complete security proof. No production
data, user transcript, live model or private credentials are used in this suite.

Release: source `c33d671bf9e03de10921b4ec2d200537ef07ca19` pushed to main;
fast and isolated workerd API CI passed at
https://github.com/1ch666/eduai2/actions/runs/36338169996 .
Dry-run and `deploy --keep-vars --strict` succeeded; Worker version
`385a1586-3c47-44b9-bf6e-b14e2e0ac261`. Public capabilities/cases returned 200,
anonymous sessions returned 401. These smoke checks do not simulate an exhausted
production counter; that boundary is covered by the deterministic unit test.
No assets, Secrets, bindings or stored data changed. Prior rollback version:
`1c60ac3d-5064-4499-94c7-a66c218c8ecd`.
