# Backend goal acceptance ledger — 2026-09-28

Audit baseline: main 86d2cec. Original goal sections 0–30 remain in scope;
frontend/Unity redesign and Claude's semantic research are not substituted for
backend work. Status is **incomplete**. This ledger is navigation and acceptance
criteria, not evidence that absent capabilities exist. Latest code deployment:
e28f5ff / Worker 06bcf6ac-af81-432e-9336-9867c97537ad. Later tests do not imply
a newer runtime deployment. Original unrelated README changes remain uncommitted.

| Goal section | Inspected evidence / status | Evidence still required before closure |
| --- | --- | --- |
| 0 scope | Backend modules/tests and preserved platform; partial | All gates below, not merely passing a subset |
| 1 invariants | No destructive migrations in recent releases; compatibility docs | Apply preservation/rollback/verification to every future DB/API change |
| 2 preservation | FEATURE-PRESERVATION.md updated | Actual group/planner/rankings/weakness integration parity |
| 3 contracts | contracts/court-v1-* and court/protocol.js; partial | Standard ok/apiVersion/requestId/timestamp/errorCode/stateVersion across versioned APIs, compatibility tests |
| 4 authority | court-rules transition, court RPC checks, seeded invariants | Formal fact/role/policy hook composition and audit all mutation paths |
| 5 events | court-journal snapshot + append-only public events, replay tests | Compare required actor/payload/previous/new version/idempotency metadata and research export; distinguish public replay from full internal restore |
| 6 validator | Narrative parser and real transition completion gate deployed | Structured fact/evidence/witness/timeline/source graph contract, dangling refs/order validation; all legal config paths |
| 7 fuzz | Seeded action/provider tests, malformed draft/protocol and import suites | Coverage across all requested boundaries, including malformed structured graph and full input/owner invariants |
| 8 races | Concurrent action and recovery HTTP tests; NPC lost-response recovery | Forced crypto/storage interleavings, real two-tab scenario, complete delayed-response matrix |
| 9 security | Session/HTTP/account checks, bounded provider output | All endpoint quotas/negative authorization, CSP, abuse/audit framework; password-version migration audit |
| 10 threat model | SECURITY-THREAT-MODEL.md created with likelihood/impact/mitigation/residual/test | Keep source/tests current; document actual mitigations as gaps close; model is not security proof |
| 11 observability | telemetry.ts + http-trace schema, safe boundary logs | Authenticated pseudonymous context, retention, model/token/latency/fallback/cost metrics |
| 12 tracing | Fresh HTTP trace ID, no trusted caller spoofing | API → DO → orchestration → provider/validator/retrieval/rerank spans; real propagation evidence |
| 13 backpressure | Timeouts/cancellation in adapter; NPC request dedup | Global bounded concurrency/queue, circuit breaker, durable dedup and explicit safe retry policy |
| 14 providers | Three typed interfaces; tutor/NPC/generation adapter deployed; stage dialogue now extracted with local fast gate passing | CI/deploy stage dialogue extraction; integrate embedding/rerank validators with future adapters; real-provider semantic quality remains unverified |
| 15 costs | Local route/user limits and kill switch; unknown token counts remain null | Durable user/session/daily budgets, quota state, accounting/reservations and global shutdown tests; never auto-buy |
| 16 availability | Existing scripted fallback and provider error codes | Formal FULL/RAG_ONLY/SCRIPTED_AI_FALLBACK/NO_AI states with truthful backend capability response and outage tests |
| 17 migration | Existing additive wrangler tags, journal checkpoint tests | Versioned migration plan/dry-run/rollback/compatibility test for each redesign; MIGRATION.md is historical repo move, not complete DB plan |
| 18 backup | No complete backup/restore implementation or drill established by this audit | Account/progress/court state/event/experiment export, protected archives, isolated restore and verification |
| 19 CI | fast-checks two jobs, actual API harness; separate game Docker | Lint/format and migration gates, backend restore/container checks; heavy evaluation separate; update pinned action runtimes deliberately |
| 20 features | Existing practice/planner/groups/rankings/progress/auth/court preserved | Real DO tests for remaining features; no content expansion required here |
| 21 analytics | Existing learning features are not a general anonymous event layer | Versioned anonymous event contract, bounded retention and all specified event kinds with privacy tests |
| 22 reproduction | experiment-run schema/relationship validator | Real artifacts/commit verification, run persistence/export/restore; no fabricated research values |
| 23 registry | version-registry schema, empty real registry, synthetic tests | Immutable version update enforcement and real values supplied by research owner |
| 24 security gate | Partial evidence across sections 8–10 | Every required security boundary tested; semantic leakage remains separate Claude evidence |
| 25 production gate | Existing deployment, basic probes, CI and trace logs | Restore, governance, degraded modes and incident drill; HTTP 200 is not AI health |
| 26 engineering gate | Typed modules, journal, race and schema tests | Complete migration/restore/contracts/architecture evidence across whole scope |
| 27 collaboration | No model research or paid inference in recent work | Keep semantics/benchmarks with Claude; provide real infrastructure hooks |
| 28 shared contract | Public court schemas and provider contracts | Contract-first additions for graph/tracing/analytics; no undocumented fields |
| 29 priority | P0 parser/completion-path foundations implemented | Next: close graph/API/internal event gaps, then global backpressure/availability and restore; not endless test-only polishing |
| 30 final outcome | Not achieved | Demonstrate every requirement above against runtime/source/artifacts; never infer completion from green CI |

## Latest verified increment — 2026-09-28

`d529d07` adds explicit-time initialization/reduction with legacy clock adapters;
reachability no longer reads wall time, and seeded invariant tests compare full
states including timestamps. All roles/templates complete under a throwing clock
test. CI 36341479597 passed; Worker 8681a49b-afb9-4234-8aaa-a68ee1f622db deployed.
No public API or SQL migration. This establishes core clock determinism, not full
historical authoritative replay or deterministic AI behavior. See COURT-DETERMINISM.md.

`ab035b7` integrates optional private case graphs at CourtRoom initialization:
shape/references, actual template fact/evidence IDs, witness cast and procedure
source allowlist, config rules and generated-template reachability before commit.
Actual SQLite tests cover persistence, rollback, deletion and public/AI isolation;
48 focused tests and CI 36341128195 passed. Worker
984670ba-6025-4df7-9734-45dcffc46f0e deployed with public read-only probes passing.
No SQL schema changes, no private producer exposed to clients. Remaining P0 work:
versioned generated-draft envelope and semantic validation hooks, direct workerd
graph RPC evidence, then remaining API/internal event contract gaps. This does not
complete the full validator/research/production goal. See CASE-GRAPH-CONTRACT.md.

## Next implementation batches and closure criteria

1. **Structured case graph (P0):** define versioned server-only fact/evidence/
   witness/timeline/source references; reject duplicate/dangling IDs and invalid
   order with bounded deterministic checks, then integrate before commit without
   changing existing saved cases. No semantic facts invented just for validation.
2. **AI admission control (P1/P2):** explicit global/per-user/session limits and
   bounded waiting, quota/circuit state, reservation expiry and no uncertain-result
   retries. First deterministic fake-provider tests; only then additive persistence
   and deployment. No new paid service or destructive migration.
3. **Recovery (P2):** catalog stored datasets and authorization, export integrity,
   isolated restore and equivalence checks. No testing restore over production.
4. **Broader feature/security parity:** real DO group/weakness/planner tests,
   structured trace propagation, analytics retention and remaining API contracts.

Use exact test commands/documents in each feature's implementation notes. CI
36339421823 proves the current fast suite and local API checks, not the missing
gates above. This audit makes no claim to have run a production attack, model
benchmark, all-browser regression or data restore.
