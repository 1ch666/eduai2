# Court engine clock boundary

`src/court-rules.ts` exports two explicit-time deterministic entry points:

- `newCourtAt(id, owner, config, timestamp)` validates existing configuration,
  detaches it and sets identical creation/update timestamps.
- `reduceCourt(state, action, timestamp)` enforces the existing rules and safe
  counters, clones input state and sets the supplied update timestamp.

For the same inputs and rules/source version, full results are equal, including
time metadata. Neither function reads the clock, storage, randomness or network.
Time is canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ`; invalid dates fail closed.
It comes from trusted server code or a recorded offline replay input, not an
extra client action field. This change does not authorize client-selected time.
The core does not impose monotonic wall-clock time; stateVersion orders events.

The legacy `newCourt` and `transition` adapters remain compatible and capture
server time once before calling the core. `CourtRoom` keeps using those adapters,
so normal mutations also execute the same reducer. Existing SQL and public DTOs
do not change, no saved timestamps are rewritten, and no migration is needed.
Rollback can revert these functions without deleting data or changing schemas.

`checkCaseReachability` now uses explicit constant fixture time, making the
validation path independent of current time. Generated content, NPC calls and
journal IDs/timestamps remain nondeterministic outer operations; this document
does not claim the entire service is a pure function or full event sourcing.
Complete historical reconstruction still needs the corresponding template/rule
version and sufficient recorded authoritative inputs. Public snapshot replay is
not a source of private authoritative facts.

Evidence:

- `test-court-determinism.mjs`: all six templates/all supported roles finish with
  exact repeatability while wall-clock reads and Math.random throw; validates
  timestamps, input immutability, detached config and legacy adapter parity.
- `test-court-invariants.mjs`: seeded mixed sequences now compare exact states,
  without stripping updatedAt. Illegal/stale actions leave state unchanged.
- `test-court-reachability.mjs`: all templates pass with wall clock disabled;
  existing 96 evidence/answer variations and negative policy checks remain.
- These plus journal/generation regressions: 44 passing tests; TypeScript noEmit
  passes. Existing basic court tests also pass (four groups).

## Verified rollout — 2026-09-28

Source `d529d07c878c3ced0fb9c3c81e82b77fd4841926` passed
[fast and local API CI 36341479597](https://github.com/1ch666/eduai2/actions/runs/36341479597).
Wrangler dry-run and deployment both succeeded. Current Worker version:
`8681a49b-afb9-4234-8aaa-a68ee1f622db` at
https://civic-law-lab-212.yichengc869.workers.dev.
No asset uploads or SQL/schema migration; existing variables were preserved.
Read-only production probes: capabilities 200, cases 200, anonymous sessions 401.
These probes are availability/access checks, not a full production court flow.
No real account, case or AI request was created for this rollout.

Rollback candidate: `984670ba-6025-4df7-9734-45dcffc46f0e` retains graph admission
and private-field allowlisting. A code rollback does not require altering saved
timestamps or deleting data. Do not roll back to pre-allowlist projections after
private graph records exist. Full disaster recovery remains a separate unfinished
goal; a recorded code rollback version is not a verified database restore.
