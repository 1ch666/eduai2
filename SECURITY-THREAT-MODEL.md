# Backend threat model — 2026-09-28

Scope: current main through 86d2cec. This is a threat model, not a penetration
test report or certification. Likelihood values are engineering estimates of
exposure, not measured attack frequencies. Impact assumes a successful attack.

## Assets and trust boundaries

Protect account credentials/recovery codes, private progress/court history,
server-only case knowledge, provider keys, authoritative actions and free quota.
Untrusted boundaries: browser requests, imported JSON, model output, text displayed
in browsers/Unity, and public HTTP tracing headers. Clients and model proposals
never authorize their own score, owner, legal eligibility or next stage.
Worker → DO RPC remains an authorization boundary: edge checks do not replace
owner/version/schema checks within CourtRoom. Administrative Cloudflare/GitHub
access and backups require separate operational access controls.

## Threat register

| Threat | Likelihood / impact | Current mitigation and source | Evidence / remaining test | Residual risk / next work |
| --- | --- | --- | --- | --- |
| XSS in user/model text | Medium / high | Text rendering and strict public DTOs; HTTP nosniff; bounded strings | Existing bridge/protocol checks; limited review in SECURITY-REVIEW-2026-09-26.md | CSP still permits unsafe-inline; inventory every rendering sink and replace inline scripts safely; no complete XSS proof |
| CSRF | High / high | src/session.ts token comparison; Origin validation; write guards in routes | check-api missing CSRF and hostile Origin; check-court-v1-api owner/CSRF | HTTPS cookie is SameSite=None, NOT Lax; relies on Origin/CSRF. Add route-by-route negative coverage |
| IDOR / cross-account access | High / high | Owner checks in CourtRoom and per-user data services | Court snapshot/action/outcome/event tests; progress isolation tests | Group membership withdrawal and every planner/private endpoint need real DO coverage |
| Session theft / fixation | Medium / high | src/session.ts __Host-, Secure, HttpOnly, Path=/; digest lookup; random tokens | check-api supplied-cookie rejection, logout, old-session invalidation | XSS may act as user even without reading cookie; real-browser cookie/privacy tests remain |
| Recovery replay / login race | Medium / high | AccountStore hashes codes, atomic consume/reset, revokes sessions and rechecks credentials after async crypto | check-api concurrent recovery and login/reset, CI 36339421823 | Finite HTTP race coverage is not all possible interleavings; protect recovery codes outside app |
| Command replay / duplicate score | High / high | Stored request result, idempotency key and expected version; transactionSync state/event/result commit | check-court-v1-api concurrent duplicate/competing/reused key; journal tests | Legacy routes and all non-court mutations need equivalent audit; do not blindly retry unknown outcomes |
| Stale state / response reordering | High / medium | Server version checks; client protocol/recovery reducer | court protocol, journal, pending recovery and local NPC lost-response tests | Mobile suspension and multi-device runtime remain separate tests |
| Rate abuse / quota exhaustion | High / high | Account/network route limits, per-user generation/NPC limits, provider deadlines and body bounds | provider tests, account checks; source src/court.ts | No verified global concurrency/queue/circuit breaker/durable daily accounting; per-user limit is not a global budget |
| Malformed import / oversized JSON | High / medium | src/http.ts bounded UTF-8 parser; progress remains selfReported | test-progress-import/isolation; protocol malformed commands | Generic JSON parser is not strict duplicate-key detection for every route; fuzz non-court endpoints |
| Data poisoning in generated cases | Medium / high | Narrative parser permits no authoritative fields; server template policy and completion-path gate | test-court-draft, test-generation, test-court-reachability | No structured chronology/witness graph; parser cannot prove truth or legal correctness |
| AI endpoint abuse / malicious upstream | High / high | Fixed provider endpoint, server credentials, no redirects, bounded body/deadline, no automatic retry | test-provider / test-npc / test-tutor | Case generation and stage dialogue still need common adapter migration; no full global kill/budget controller |
| Model output injection | High / high | Treat proposals as data; validate permitted fields/fact IDs before commit; text output | test-npc rejects invented IDs; generation denies authority fields | Semantic jailbreak/leakage evaluation belongs to Claude; schema checks are not prompt-injection immunity |
| Hidden evidence disclosure | Medium / high | Public court projection and NPC knowledge subset; model cannot select arbitrary fact IDs | NPC/protocol/journal tests; existing limited security review | Full role-by-stage leakage benchmark and all exports require review; do not ship hidden truth to Unity |
| Logs leaking credentials/private text | Medium / high | src/telemetry.ts allowlisted path/method, no bodies/cookies/raw errors | test-telemetry schema/redaction/concurrent isolation | Platform/vendor logs and retention are not fully audited; sampled logs are incomplete audit history |
| Destructive migration / backup compromise | Medium / critical | Existing incremental migrations; no reset/drop used in this work | Journal transaction/migration tests are limited | Full account/progress/court/event backup and restore drill missing; backups need encryption, access control and retention |

## Operational response and release gate

1. Collect request/trace ID, time and status only, never passwords, codes or private
   transcripts. See docs/OBSERVABILITY.md for safe debugging.
2. Resolve uncertain mutations with authenticated outcome GET; absence of sampled
   telemetry is not proof an action did not commit.
3. Use reviewed existing deployment rollback only when appropriate. Code rollback
   does not restore deleted/corrupted data. Do not reset migrations or clear DOs.
4. Do not change ownership, Secrets, permissions or billing as an incident shortcut.
5. A release must preserve current auth/CSRF/owner/idempotency tests, document data
   compatibility and expose real fallback. New protections need executable tests.

Outstanding highest-risk work: global quota/concurrency controls; restore drill;
all-private-route isolation coverage; CSP hardening; structured case graph checks.
No production attack, account reset, permissions change or live-model test was
performed to write this document. Previous dated review remains historical evidence;
its stale missing-race claims are superseded by the explicitly linked newer tests.
