# Server-only case graph v1 — contract-first foundation

Deployment evidence (2026-09-28): source `ab035b79b926bf1e491bd154a27b23ca98650d6f`,
fast/local-API CI [36341128195](https://github.com/1ch666/eduai2/actions/runs/36341128195)
passed. Wrangler dry-run and deployment succeeded; Worker version
`984670ba-6025-4df7-9734-45dcffc46f0e`. No asset files changed. Post-deploy read-only
checks: capabilities 200, cases 200, anonymous sessions 401. No production graph
was inserted, no live inference or schema migration was executed. Safe rollback
candidate: `4d206cf3-a3c5-49b5-8efd-a1e38db88d42` (public allowlist retained).
Storage transaction behavior follows the
[Cloudflare SQLite storage contract](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#transactionsync).

Machine-readable schema: `contracts/case-graph-v1.schema.json`.
Authoring validator: `scripts/case-graph-contract.mjs` (Ajv, already installed).
Tests: `node --test scripts/test-case-graph-contract.mjs`.

This graph describes references only, not legal truth. It must never be sent
directly to Unity/browser: even an ID relationship can disclose private witness
knowledge. It is not an expansion of the public court v1 DTO or model prompt.

- facts: declared fact IDs, maximum 64.
- evidence: IDs and linked fact IDs, maximum 32.
- witnesses: IDs, fact IDs and evidence IDs, maximum 16.
- timeline: IDs, nonnegative integer order, linked fact IDs and afterIds, maximum 64.
- legalSourceIds: references to a separate server-approved source allowlist.

IDs are unique within typed namespaces; a fact ID cannot satisfy an evidence
reference merely because its text matches. Reference arrays have at most 64
unique IDs. Unknown fields and schema versions fail closed. The policy allowlist
is a separate argument supplied by the trusted caller, never from model data.
The checker emits fixed codes only, no private graph fragments in diagnostics.

Timeline order is an explicit author-supplied ordinal, NOT a guessed calendar
date. Events must be listed in nondecreasing order. A declared after relationship
must point to a strictly earlier event, which also rejects cycles/self references.
Independent events may have equal order; unknown real-world ordering must not be
fabricated to satisfy this checker. Empty timeline/witness lists are permitted;
passing an empty list does not claim the case has a complete timeline or cast.

Current status: schema, standalone authoring validator and dependency-free Worker
module `src/case-graph.ts` exist. Runtime validation accepts unknown inputs and
returns fixed error codes; it does not use Ajv, eval, filesystem or network.
Authoring and runtime share typed relationship validation after their independent
shape checks. Eight test groups pass, including 1,024 seeded nested mutations that
compare runtime acceptance/error codes with Ajv schema validation. Runtime also
rejects inherited record fields and getters (outside the normal JSON boundary).
Arrays must be dense plain arrays with only indexed enumerable data properties
and length. Accessors, inherited entries, custom iterators, symbol properties and
extra array fields are rejected without calling their hooks. This is deliberately
stricter than Ajv for non-JSON JavaScript objects; schema parity applies to JSON.
`parseCaseGraph(unknown, policy)` returns a deeply detached, explicitly projected
`CaseGraph` or null after the same shape/relation checks. Frozen valid JSON is
accepted. Neither later caller mutation nor mutation of the returned graph can
modify the other. The copy is mutable for trusted server use, not an immutable
authority token: any later server transformation still needs validation.
TypeScript noEmit passes. These tests establish sampled parity, not a formal
proof covering arbitrary JavaScript Proxies or every possible JSON input.
`CourtRoom.init` now invokes it when an optional trusted-server graph is supplied.
Public HTTP creation and case generation do not yet produce or accept graphs. Existing narrative
cases have no explicit fact/witness/timeline graph; do not automatically invent
these relationships or claim they were verified. Legal source membership is not
legal accuracy, citation grounding or effective-date verification.

Next integration gate: define the producer's versioned structured draft envelope,
fact/role semantic hooks and rejection handling before enabling automatic graph
generation. Legacy cases remain readable; absent graph means unavailable, not
verified. No role-specific private graph projection is implemented or exposed.

## Storage admission contract (implemented)

`CourtRoom.init(id, owner, config, generated?, graph?)` accepts the graph only
from a trusted server caller, never from the public HTTP creation body. Absent
means legacy graph unavailable; null or malformed input is not absence.
The selected config must pass existing role/age/assistance rules; a supplied
generated template must pass reachability and immutable base-policy checks.
Graph validation then binds against that exact selected template:

- `fact-N` is the zero-based index in its facts array; all facts occur exactly once.
- Evidence IDs equal the template evidence ID set, not a self-contained invented set.
- Witness IDs must be NPC IDs with the server cast role `witness` (currently `Witness`).
- Sources must belong to that procedure's existing server `LEGAL_SOURCES` allowlist.

These bindings do not infer witness knowledge or establish legal truth. Authors
still supply relationships and timeline; the checker only establishes structural
validity and a bounded completion path. No synthetic graph is made for old cases.
The detached graph is stored as optional `state.body.privateGraph`, with its own
schemaVersion 1, in the same transaction as the initial public event. No SQL DDL,
namespace, binding or migration changes. Existing init retries cannot replace an
already-created graph; deleted IDs remain tombstoned. Public views/events and NPC
knowledge omit it. Deletion removes it with the state row.

Rollout: run SQLite boundary/rollback tests and existing API CI before deployment.
Existing callers keep their four arguments. Do not enable an external graph
producer until its own trusted envelope and semantic validation are reviewed.
Rollback must retain the explicit public projection from `1fd7013` or later;
older spread-based projections could disclose a stored private graph. Do not
remove stored fields or recreate databases to roll back the code.

Storage evidence: six additional `test-court-journal.mjs` groups use actual Node
SQLite with mocked DO lifecycle. They cover rejected writes, policy/role/age/aid
checks, restart/action persistence, owner isolation, init retry, content deletion,
injected event-write rollback, all six templates with generated evidence IDs,
and public event/AI request canaries. The AI test uses a fetch replacement, not
real inference. Combined graph/journal/court/generation run: 48 passing tests;
TypeScript noEmit passes. This is not proof of semantic correctness or a direct
workerd RPC graph test; existing local API CI covers legacy HTTP compatibility.

Local evidence: eight test groups pass, covering deterministic/nonmutating success,
typed dangling refs, duplicate IDs, unknown sources, backwards/self/cyclic/equal
order dependencies, unknown authority fields, missing fields, malformed numbers,
sparse arrays and bounds, array getter/iterator rejection and nested copy isolation.
The new accessor regression failed against the preceding implementation with
`array getter executed` from `Array.from`; descriptor-based validation fixes it.
Existing fast CI automatically includes these tests. The storage integration
changes only an optional JSON field, not SQL schema or a production migration.
No live models, real case data or new services are used.
