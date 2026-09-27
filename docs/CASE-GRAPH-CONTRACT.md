# Server-only case graph v1 — contract-first foundation

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
No runtime route, case generation or persistence invokes it yet. Existing narrative
cases have no explicit fact/witness/timeline graph; do not automatically invent
these relationships or claim they were verified. Legal source membership is not
legal accuracy, citation grounding or effective-date verification.

Next integration gate: define a versioned structured draft envelope with trusted
template identity; integrate the runtime validator and template/reachability checks
before commit; persist the
versioned graph server-side and project only authorized public references. Keep
legacy saved cases readable and explicitly mark graph unavailable. Prove no hidden
graph leaks through public view, journal, NPC context or export. Only then deploy.
This contract-first commit does not itself require migration or deployment.

Local evidence: eight test groups pass, covering deterministic/nonmutating success,
typed dangling refs, duplicate IDs, unknown sources, backwards/self/cyclic/equal
order dependencies, unknown authority fields, missing fields, malformed numbers,
sparse arrays and bounds, array getter/iterator rejection and nested copy isolation.
The new accessor regression failed against the preceding implementation with
`array getter executed` from `Array.from`; descriptor-based validation fixes it.
Existing fast CI automatically includes this test. This change does not wire the
parser into an API or storage path, change SQL, or require a production migration.
No live models, real case data or new services are used.
