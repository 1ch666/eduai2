# Generated-case completion gate

`src/court-reachability.ts` checks a constructed, typed case after narrative
parsing, before `validateGenerated` returns it for persistence. It compares
procedure/mandatory assistance/aid approval with the selected built-in template,
rejects duplicate or invalid evidence IDs and unreachable answer indexes, and
executes a bounded completion path using the real `newCourt` and `transition`.

Every supported role must reach completed stage 5 with no remaining actions.
Non-observers review all evidence and answer once; judges also complete every
required procedural ruling. Observers use the existing five-step path. Validation
performs at most 32 commands per role and accepts at most 16 evidence items.
It uses disposable in-memory state only, no model, session storage or event log.
The externally observable result is deterministic; internal timestamps produced
by the unchanged transition function are discarded, not compared or persisted.

The gate is internal: it is not a public endpoint, does not expose answer keys,
and does not claim to parse arbitrary untyped values. The narrative parser is
the preceding unknown-data boundary. Invalid candidates return null through the
existing generation failure handling, with no new response contract.

Verification: 6 templates x 4 evidence counts x 4 answer positions (96 candidates),
each checked twice for all supported roles and input immutability. Negative cases
cover duplicate/missing IDs, sparse collections, invalid answer indexes and legal
policy changes. Generation integration tests prove an unknown or policy-altered
base is rejected. Run:

```text
node --test scripts/test-court-reachability.mjs scripts/test-generation.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Both passed locally on 2026-09-28; existing fast CI discovers the new suite.
This proves existence of one legal completion path per supported role, not all
possible paths, all ages/aid combinations, legal accuracy, semantic chronology,
fact/witness reference graphs, network delivery, or full case-validator completion.
Those requirements remain outstanding or are covered by separate tests.

Compatibility/migration: only new AI-created cases use this gate. Existing saved
cases and library selection are unchanged; no schema migration or data rewrite.
Rollback is a source revert of the generation integration; there is no data rollback.
No Unity, frontend, assets or game-container rebuild is needed.
