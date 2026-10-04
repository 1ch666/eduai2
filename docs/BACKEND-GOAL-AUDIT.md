# Backend goal acceptance ledger — 2026-09-28

Audit baseline: main 86d2cec. Original goal sections 0–30 remain in scope;
frontend/Unity redesign and Claude's semantic research are not substituted for
backend work. Status is **incomplete**. This ledger is navigation and acceptance
criteria, not evidence that absent capabilities exist. Latest code deployment:
684bf9d / Worker 70e01207-a028-460c-a048-f755cf4f9e98 (private court journal).
CI 36355287105 and deploy/dry-run passed; release evidence in COURT-PRIVATE-JOURNAL.md.
Anonymous production probes passed; authenticated private-history acceptance remains
open. Original unrelated README changes remain uncommitted.

| Goal section | Inspected evidence / status | Evidence still required before closure |
| --- | --- | --- |
| 0 scope | Backend modules/tests and preserved platform; partial | All gates below, not merely passing a subset |
| 1 invariants | No destructive migrations in recent releases; compatibility docs | Apply preservation/rollback/verification to every future DB/API change |
| 2 preservation | FEATURE-PRESERVATION.md updated | Actual group/planner/rankings/weakness integration parity |
| 3 contracts | v1 public DTOs plus deployed court v2 HTTP envelope, shared command recovery and read-only event audit; actual workerd checks passed | Version creation/deletion and remaining platform APIs, preserving mutation identity; authenticated production acceptance remains open |
| 4 authority | court-rules transition, court RPC checks, seeded invariants | Formal fact/role/policy hook composition and audit all mutation paths |
| 5 events | Public journal plus readonly v2 audit verifies actor/previous version/idempotency from exact saved receipts; old unknown provenance stays null; malformed/cross-session rows rejected | Full internal state replay/restore and research export remain incomplete; legacy mutations/creation lack complete verified metadata |
| 6 validator | Narrative parser and real transition completion gate deployed | Structured fact/evidence/witness/timeline/source graph contract, dangling refs/order validation; all legal config paths |
| 7 fuzz | Seeded action/provider tests, malformed draft/protocol and import suites | Coverage across all requested boundaries, including malformed structured graph and full input/owner invariants |
| 8 races | Concurrent action and recovery HTTP tests; NPC lost-response recovery | Forced crypto/storage interleavings, real two-tab scenario, complete delayed-response matrix |
| 9 security | Session/HTTP/account checks, bounded provider output | All endpoint quotas/negative authorization, CSP, abuse/audit framework; password-version migration audit |
| 10 threat model | SECURITY-THREAT-MODEL.md created with likelihood/impact/mitigation/residual/test | Keep source/tests current; document actual mitigations as gaps close; model is not security proof |
| 11 observability | HTTP + bounded provider records share server-created context; 318 fast tests | Authenticated pseudonymous context, retention, fallback/validator spans and actual cost accounting; sampled logs are not billing records |
| 12 tracing | Server context flows HTTP → CourtRoom/Learner → provider; pipeline hook contract + actual stage structural validator added | Dedicated DO/domain spans, other validators, retrieval/reranker adoption, hierarchy and production pipeline evidence; schema/tests do not prove legal accuracy |
| 13 backpressure | Governed production Ollama routes; durable concurrency/queue/circuit, timeout and dedup; real workerd tests | Authenticated production behavior and outage verification; versioned study tickets replace finite legacy tombstones |
| 14 providers | Three typed interfaces; tutor/NPC/generation/stage dialogue/photo adapter deployed; photo CI 36342849873 passed; vendor HTTP isolated in adapter | Integrate embedding/rerank validators with future adapters; complete composition/governance and real-provider semantic quality evidence |
| 15 costs | Shared durable account/user/scope daily attempt budgets and shutdown flag; unknown tokens remain null; tutor/photo adoption deployed | Live quota/availability and accounting surfaces, retention upgrade, authenticated production verification; never auto-buy |
| 16 availability | Public status reads actual account admission; config, switch, queue/budget/circuit errors distinguished; health explicitly not-probed; deployed 9353127 | Formal FULL/RAG_ONLY/SCRIPTED_AI_FALLBACK/NO_AI feature-level result contract, user-specific eligibility and provider-health freshness; admission READY is not live model success |
| 17 migration | Existing additive wrangler tags, journal checkpoint tests | Versioned migration plan/dry-run/rollback/compatibility test for each redesign; MIGRATION.md is historical repo move, not complete DB plan |
| 18 backup | AES-GCM bounded envelope and synthetic 12-table court restore drill implemented; b3a0c14 CI 36354758528 passed | Authorized complete exporters, key custody, workerd/production recovery and account/progress/experiment restore remain unfinished; see BACKUP-ENVELOPE.md |
| 19 CI | fast-checks two jobs, actual API harness; separate game Docker | Lint/format and migration gates, backend restore/container checks; heavy evaluation separate; update pinned action runtimes deliberately |
| 20 features | Existing practice/planner/groups/rankings/progress/auth/court preserved | Real DO tests for remaining features; no content expansion required here |
| 21 analytics | v1 six-kind numeric event contract, scoped reducer, SQLite withdrawal guards and transactional alarm scheduler; real local workerd SQL/alarm rollback passed; no production collection enabled | Versioned producers, consent/scoping, dedicated DO host, real timer delivery/eviction/retry tests and production integration; see LEARNING-EVENTS.md |
| 22 reproduction | experiment-run schema/relationship validator plus offline bounded artifact hashing and exact local Git commit existence checks | Actual execution provenance, artifact custody and run persistence/export/restore; no fabricated research values |
| 23 registry | v1 schema plus append-only identity validator and Git-baseline CI check; CI 36355000990 passed; real registry intentionally empty | Real values supplied by research owner and protected artifact custody; see RESEARCH-REGISTRY.md |
| 24 security gate | Partial evidence across sections 8–10 | Every required security boundary tested; semantic leakage remains separate Claude evidence |
| 25 production gate | Existing deployment, basic probes, CI and trace logs | Restore, governance, degraded modes and incident drill; HTTP 200 is not AI health |
| 26 engineering gate | Typed modules, journal, race and schema tests | Complete migration/restore/contracts/architecture evidence across whole scope |
| 27 collaboration | No model research or paid inference in recent work | Keep semantics/benchmarks with Claude; provide real infrastructure hooks |
| 28 shared contract | Public court schemas and provider contracts | Contract-first additions for graph/tracing/analytics; no undocumented fields |
| 29 priority | P0 parser/completion-path foundations implemented | Next: close graph/API/internal event gaps, then global backpressure/availability and restore; not endless test-only polishing |
| 30 final outcome | Not achieved | Demonstrate every requirement above against runtime/source/artifacts; never infer completion from green CI |

## Latest verified increment — 2026-09-28

2026-10-04 release 6ca74cf / Worker 41233f8b-5385-4d01-92c7-c207667ab246:
v2 DELETE with strict v1 command identity, version fencing,
atomic content erasure and durable terminal receipt. Local fast gate 425 tests
and real workerd HTTP checks passed; CI 37166684020 and deployment passed.
Production anonymous GET/DELETE 401 and public read probes passed; authenticated
production deletion/recovery remains unverified. Additive one-row receipt
table, legacy API preserved, no actual user data deleted. See COURT-API-V2.md.
Creation versioning, complete mutation provenance and broader goal remain open.

Private snapshot journal (deployed from 684bf9d): deduplicated immutable context
plus per-event mutable snapshots now permit exact internal version reconstruction.
See COURT-PRIVATE-JOURNAL.md. Public/API replay still excludes these records.
Transaction, deletion, legacy gaps and integrity tests exist. Persistent cleanup
trigger now covers pre-feature DELETE sequences; actual workerd local-api job
36353531265 passed reconstruction, deletion and rollback atomicity. Full import
validation and protected operator archive/restore remain unfinished.
This release is not proof of section 18 disaster recovery completion.

Released 78cd1e2 adds response-level FULL/RAG_ONLY/SCRIPTED_AI_FALLBACK/
NO_AI schema and actual tutor/photo/legacy NPC source mapping. RAG_ONLY is reserved,
not emitted by dictionary lookup. Stage/generation/v1 projections and health
freshness remain incomplete. See AI-OUTCOME.md for compatibility and rollback;
deployment evidence is separate from local tests. Stage outcome persistence now
is deployed with old-row compatibility and expiry/restart races;
case-generation provenance, v1 public projection and health freshness remain open.

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

2026-09-28 retention candidate: durable admission host now validates stable
server-issued day-prefixed IDs before atomic expiry/pruning/admission. Ten SQLite
groups cover 30 days and replay after pruning; this is lazy admission-metadata
cleanup only, not deletion of platform data. Private coordinator is still not
bound in production. Next: provider wrapper and endpoint adoption, preserving
issuance identity and fail-closed behavior across RPC uncertainty.

2026-09-28 durable admission candidate: actual AIAdmission class plus atomic SQLite
host, metadata/version guard, 1 MiB serialization cap and identity-fenced receipts.
Seven SQLite tests passed; isolated workerd RPC CI added. Production bindings,
provider wrapper, age-validated retention and rollout are still required. Never
deploy the local fixture. The global governance goal is not yet satisfied.

2026-09-28 persisted admission contract: exact JSON shape schema plus safe
data-property restore validator now reject malformed/cross-field-invalid ledgers
without resetting budgets. Sixteen focused groups pass, including 512 seeded
shape mutations and restore checks on 3,000 reducer transitions. Durable host,
bounded serialized decoding and endpoint integration remain unimplemented; this
does not change production behavior. See AI-ADMISSION-CONTRACT.md.

2026-09-28 admission core candidate: providers/admission.ts defines deterministic
bounded FIFO, concurrency leases, attempt budgets (UTC global/user/session/day),
kill switch, quota/failure circuit epochs, nullable token accounting and explicit
retention. Eleven tests include 3,000 seeded command transitions and full replay
equivalence. It is deliberately NOT wired into runtime routes yet. Next required
steps are persisted-state schema validation, atomic durable host, all-provider
wrapper and local workerd/production verification; see AI-ADMISSION-CONTRACT.md.
Do not count this as deployed global governance or monetary cost enforcement.

2026-09-28 released: legacy stage dialogue now reserves each state version in
CourtRoom SQLite before inference. Seven actual-SQLite race/migration groups
passed (42 focused tests total); local workerd route coverage added. See
STAGE-DIALOGUE-DEDUP.md for compatibility, cleanup and rollback constraints.
This advances request deduplication only, not global budgets/concurrency or the
full production gate. Source 8945286 passed CI 36343636660 (fast/local-api) and
deployed as e37d0a79-a856-4378-a40c-bb1ac466e2d4. Read-only public/auth probes
passed; authenticated production inference/migration under load not exercised.

2026-09-28 provider wrapper candidate: `providers/admitted.ts` now composes the
admission RPC with LLMProvider, bounds queue/RPC/inference/cancellation, hashes
the pinned payload and never starts from an ambiguous/existing grant. Twelve
focused groups pass; local workerd fixture gains wrapper+SQLite composition.
This is not yet endpoint adoption or a production binding/deployment. See
AI-ADMISSION-CONTRACT.md for timing, settlement uncertainty and rollout gaps.

Next candidate adds `AI_ADMISSION` SQLite class/binding (v9) and adopts it in
stageDialogue using original persisted timestamps plus domain-separated scope
hashes. All other inference endpoints still require adoption. Full fast checks
and Wrangler 4.136.3 dry run passed locally; deployment/CI evidence is tracked in
AI-ADMISSION-ROLLOUT.md. Do not infer all-platform cost control from this stage.

Released stage admission: source 208925a, CI 36346556730 checks/local-api passed,
Worker f2ee1d91-51fd-4cd7-97c1-517dccd6a725. Additive v9 deploy succeeded, no
updated static assets. Public capabilities/cases200 and anonymous sessions401
probes passed with request IDs. Other inference paths, live authenticated
admission verification and the broader remaining production gates remain open.

NPC/generation candidate now reuses the same governed account coordinator and
original persisted issuance timestamps. Legacy/v1 NPC, generation recovery and
random library fallback retain their existing contracts. Tutor/photo adoption
and truthful live availability remain open; see AI-ADMISSION-ROLLOUT.md. No new
schema migration or source prompt/semantic research in this batch.

NPC/generation release evidence (2026-09-28): source b0650e2; CI 36347065503
passed checks/local-api; actual Worker deployment exited 0 with version
6f7d3416-efea-4b44-b25c-8176227ad9c0. Read-only capabilities/cases/sessions
probes returned 200/200/401 with request IDs. No assets or migrations changed.
These probes do not verify authenticated production inference, live quota,
tutor/photo admission, recovery or the remaining goal gates.

Released source 0e7ad2c: tutor/photo now use per-owner persisted reservations and the
shared governed provider. Local fast gate passed 298 tests; real workerd Learner
RPC passed concurrent dedup/conflict/owner isolation; dry run passed. See
STUDY-AI-ADMISSION.md: finite 4,096-entry legacy tombstones, no answer cache,
versioned expiring-ticket retention still needed, and live availability is still
configuration-based. CI 36348143950 passed; Worker
d4bd7403-7914-469c-91d2-3c14a9955098 deployed with anonymous probes passing.
Do not treat this as completing all cost/recovery gates.

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
