# Game / Education Phase — priority override, 2026-10-04

Status: in progress, not accepted. Latest user instruction takes priority over
nonessential backend expansion. Preserve the complete original Backend Goal and
`docs/BACKEND-GOAL-AUDIT.md`; resume all remaining items after this phase's acceptance.
Do not mark the Backend Goal complete or discard it. This is a sequencing change.

## Current evidence and boundary

- Existing Unity WebGL court, NPC bridge, role knowledge projection, evidence
  viewer, authoritative procedure, recovery, idempotency and journal are present.
- No integrated evidence presentation → deterministic contradiction → follow-up
  gameplay is verified yet. Existing view/dialogue functions are not that feature.
- Backup envelope, validators and isolated restore drills exist; a complete
  production backup/restore service is NOT complete.
- Uncommitted group privacy race fix (`src/groups.ts`,
  `scripts/test-groups-isolation.mjs`) is separate security work. Preserve it and
  test/release separately; do not mix it into game feature commits.
- User-owned README/provider changes and AGENTS.md must remain untouched.

## Priority and permitted backend work

First complete gameplay, evidence reasoning, NPC follow-up, contradictions,
objectives/Evidence Board, debrief/review, animation, demo and education study flow.
Backend changes must directly support those features or fix security/data-loss/
race/outage/API-breaking/privacy bugs. No unrelated architecture, abstraction,
distributed feature, protocol version or purposeless event expansion.
Preserve server authority, role isolation, recovery, idempotency and tracing.

## First complete case

Original teaching fixture: a classroom tablet and a time discrepancy. The witness
says they left at 20:00; a stipulated teaching camera record shows the witness
still present at 20:17. This challenges the time statement, not proof of theft,
intent, guilt or a legal verdict. Do not overwrite old saved tablet cases.
New case/version must explicitly opt into authored investigation data; generated
cases cannot inherit contradictions just because they share a base template ID.

## Required implementation and acceptance

1. Evidence presentation: acquired/available evidence, responsive NPC, player
   role and legal procedure stage all checked by server before model invocation.
2. Contradictions: authored or deterministic only. Contract includes
   contradictionId, statementFactId, evidenceFactId, relatedNpcId, type, severity,
   explanation, unlockCondition. No LLM detection or authority.
3. Follow-up: presenting the relevant evidence after hearing the relevant statement
   unlocks its specific follow-up. Retry cannot rediscover/reward it twice.
4. NPC prompt: projection of own/allowed facts, explicitly presented evidence and
   necessary history only. Never answer key, hidden evidence, other roles' private
   facts, final answer or scoring. AI only phrases a response; truthful fallback.
5. Evidence Board: discovered evidence, questioned roles, important statements,
   discovered contradictions and objectives. No undiscovered evidence names.
6. Objectives: server-derived counts/conditions for questioning, key evidence,
   contradiction, procedure completion and final judgment; not frontend flags.
7. NPC visuals: idle/listening/thinking/speaking/nervous/confident/surprised/objecting.
   Presentation states never control authoritative case transitions.
8. Completion locks result. Read-only review keeps evidence, journal, own questions,
   discovered contradictions, timeline and learning analysis accessible.
9. Debrief: evidence coverage, NPC coverage, contradictions, procedure completion,
   hint count, final judgment, concepts and improvement areas—not just right/wrong.
10. Reasoning review: authored teaching explanation linking statement → evidence →
    inconsistency → discovery. Never model chain-of-thought.
11. Error categories: ignored key evidence, incomplete questioning, missed
    contradictions, fact/inference confusion, procedure errors, single-testimony
    dependence and legal-concept errors. Link to practice/weakness/tutor without
    claiming unmeasured diagnoses or objective grading of arbitrary AI text.
12. Tutorial/normal/challenge: vary hints; challenge hides contradiction totals.
    Truth and correct answers stay identical. Hint use is server-recorded.
13. Demo: real start → roles → evidence → question → present → discover → follow-up
    → procedure/final judgment → debrief. Shorten UX, never bypass server checks
    or fabricate AI, participant records or research results.
14. After core flow: pre-test, post-test, survey, consented anonymous events:
    case_started/evidence_viewed/npc_questioned/evidence_presented/
    contradiction_found/hint_used/final_answer/case_completed. No passwords,
    tokens, full prompts, private truth or unnecessary free text.
15. Real user round records pre/post scores, duration, hints, evidence coverage,
    contradictions and survey. **尚未進行正式使用者實驗**. Synthetic tests are not
    participant evidence. Arrange genuine participation when the flow is ready.

## Work sequence / gates

- Phase 1: preserve stable backend and inventory current contracts.
- Phase 2–3: evidence reasoning + deterministic contradiction/follow-up; tests
  cover unauthorized/hidden evidence, wrong stage/role/NPC, duplicates, stale
  versions, recovery, AI outage and prompt projection.
- Phase 4: server objectives + Evidence Board; reveal only unlocked data.
- Phase 5: locked result + debrief/read-only review, reload and replay.
- Phase 6: honest competition demo using real backend.
- Phase 7: pre/post-test, survey and privacy-scoped event recording.
- Phase 8: actual 3D entry → NPC → evidence → presentation → contradiction →
  follow-up → projected reply → procedure → judgment → analysis → review.
  Verify desktop controls and mobile joystick/tap; record real device limits.
  Unity source/tests alone are not a published playable result. Build Release,
  verify WebGL bytes/size/loading, publish and update Docker/handoff evidence.
- Phase 9–10: resume every remaining Backend Goal/Audit requirement (versioning,
  random/AI creation, provenance, replay/restore, graph, authorization/CSP/abuse,
  observability, governance, availability, migrations, backup/DR, analytics,
  research custody and incident drills). No scope reduction.

## Release truth

Each increment must separate implemented code, integration, local tests, actual
Unity build, browser/device tests, deployed artifacts and real participant study.
Do not describe this phase as complete before the full eleven-step gameplay
acceptance above and required evidence are present. No new paid service/assets.

## Integrated implementation checkpoint — 2026-10-04

`src/court-investigation.ts` now has the authored time-discrepancy definition,
deterministic view/question/present/follow-up/hint transitions and an allowlisted
Evidence Board projection. It rejects unavailable/unviewed evidence, invalid
roles/NPCs/stages, undiscovered follow-ups and mutations after completion.
Repeated discovery/follow-up does not duplicate their state. The initial board
does not publish the hidden evidence title or total contradiction count.

The fixed `tablet-time-discrepancy-v1` template is now connected to CourtState,
CourtRoom's existing action receipts, atomic public/private journals and strict
private-state validation. Old templates and generated variants do not inherit
its investigation state. No new DO, SQL migration or public protocol version.

Implemented and locally tested:
- Server action descriptors for investigation, authored original statements,
  evidence presentation, deterministic contradiction, follow-up and counted hints.
- Viewing evidence does NOT give it to NPCs. Only the specifically targeted NPC
  gets it through Knowledge Projection after presentation. AI output never marks
  a statement heard or unlocks a contradiction.
- Original-statement actions deliver explicitly labelled authored text. Versioned
  follow-up actions now automatically attempt governed AI through the existing
  durable NPC request path. Only the witness's statement and presented evidence
  reach its Knowledge Projection; AI cannot unlock or decide contradictions.
- Follow-up has a server-authored question, one durable receipt and one committed
  state transition. Concurrent duplicates recover pending/committed outcomes;
  retries never invoke AI again. A new request cannot repeat a completed follow-up.
  Expiry, deletion or intervening state changes fence late provider results.
- Disabled/unavailable AI, quota exhaustion or invalid replies use explicitly
  labelled authored teaching dialogue, not fake AI. The legacy unversioned action
  endpoint retains authored follow-up for compatibility; current web/versioned
  clients use the automatic AI path. No additional provider/model configuration.
- New case catalogue and initial snapshots omit hidden evidence names/text.
- Web `court/investigation-board.js` shows discoveries, server-derived objectives,
  read-only completed review and basic coverage/hints/contradiction/concept analysis.
  Unmeasured reasoning skills are not assigned fabricated diagnoses or scores.
- `court/action-panel.js` renders the existing versioned action descriptors and
  current feedback. `court/court.js` links the investigation panel and disables
  random rewriting in setup when selecting the authored lesson.
- `court/investigation-controls.js` groups discovery, visible evidence, target NPC,
  original statement, presentation and unlocked follow-up in the action panel.
  It uses only current server descriptors, never computes contradictions, and
  blocks stale buttons on version/session changes, hidden targets or pending
  recovery. Future unknown investigation actions retain the generic UI fallback.
  This is web procedure-mode integration, NOT yet a new Unity world interaction.
- The existing Unity evidence/procedure box bridge now opens that same recoverable
  action panel for investigation cases. The previous evidence-only box was empty
  before discovery and could not reach discovery actions. Opening a box remains
  navigation only: no automatic discovery, AI request or state mutation. Old cases
  retain their existing panels. Completed investigation cases open read-only board
  and debrief; the board is hidden until its owner/session/version matches the
  authenticated action snapshot. No Unity binary modification is needed for this
  host-side routing, but real WebGL/browser acceptance is still outstanding.
- Existing completion semantics remain: wrong objective answers invite retry;
  a completed result cannot be changed. This is not a full first-attempt assessment.

Verification: full `node scripts/ci-fast.mjs` passed (type generation, TypeScript,
frontend checks, regression tests, existing WebGL integrity/size gate). Added
SQLite-backed tests cover the investigation flow, owner isolation, stage rejection,
duplicate receipt recovery, write rollback, object recreation, private journal
reconstruction and completion lock. Projection tests verify evidence does not
reach any NPC merely because the player viewed it; board tests render text only.
These are local automated tests, not real browsers, Unity runtime or participants.

Follow-up UI checkpoint: `scripts/test-investigation-controls.mjs` covers visible
evidence, target selection, pending recovery, revoked actions, completed review,
cross-session stale buttons and unknown-action compatibility. The 441 root
`scripts/test-*.mjs` tests (excluding the separate dictionary corpus suite) and
frontend check passed after this UI change. This run does not include Unity
Editor/PlayMode, visual layout, live provider or physical mobile acceptance.

Real local runtime checkpoint (2026-10-04):
`node scripts/check-investigation-api.mjs http://127.0.0.1:8794` passed against
Wrangler 4.136.3 local workerd with isolated SQLite persistence and NPC AI disabled.
It creates synthetic accounts, performs the judge's full investigation through
HTTP -> Worker -> CourtRoom RPC, checks owner/CSRF/stage rejection, presentation,
contradiction unlock, labelled authored follow-up, identical retry/recovery receipt,
procedural rulings, final answer, debrief metrics and immutable completed review.
It removes only its own synthetic case; local synthetic accounts remain in the
isolated test storage. Loopback-only target validation rejects production URLs.
Fast regression CI now includes this scenario with a separate disposable storage
directory so auth quotas from other scenarios do not interfere. This is not a
browser/WebGL run, live model success or educational effectiveness evidence.

Desktop browser checkpoint (2026-10-04): the real local workerd at 8794,
with synthetic account and AI disabled, passed UI clicks for three original NPC
statements, discovery, presentation to Witness, contradiction unlock, labelled
authored follow-up, both correct rulings, closing investigation, statement and
final judgment. Version 13 showed all six objectives complete, evidence/NPC
coverage 100%, one contradiction, zero hints and procedure completion 100%.
Reload and resume preserved the completed read-only board. These are QA fixture
results, NOT participant research results or live-model acceptance. Browser
inspection found duplicate reply/feedback and controls buried below the notebook;
the panel now deduplicates identical feedback and puts controls before notes.

Manual verification next (Unity bridge, real AI and physical mobile): choose `平板失蹤：十七分鐘的落差`, create a fixed cloud
session, acknowledge → statement → investigation panel → original statements →
discover → present to Witness → follow-up → required procedural rulings → close
investigation → response → final answer → read-only analysis. Reload at each
step; verify the old WebGL bridge still renders the same server snapshot.

NOT completed / next work:
1. Dedicated Unity evidence/NPC presentation interaction and real browser acceptance;
   no new Unity build or production deployment was done for this checkpoint.
2. Verify automatic AI follow-up on the deployed Worker with a real signed-in
   browser. Local provider responses are synthetic test fixtures, not live AI
   acceptance; test lost responses, provider failure and receipt recovery as well.
3. NPC animation/states, richer evidence UI/cameras, difficulty and honest Demo Mode.
4. Complete error-category measurement, first-attempt judgment tracking and links.
5. Pre/post tests, survey and consented gameplay event integration.
6. Desktop/mobile end-to-end verification and a real participant round:
   **尚未進行正式使用者實驗**.
7. Only after the full Game / Education acceptance, resume Backend Goal Audit.

Demo guide increment (2026-10-04): `court/demo-guide.js` adds an opt-in
presentation guide to the procedure panel for the authored investigation case.
It reads only visible NPC names, enabled server actions and same-version public
objectives. It guides original statements, discovery, presentation, unlocked
follow-up, procedure and final self-selected judgment; completed cases point to
analysis/replay. Recovery blocks progress guidance, stale/missing boards hide it,
and switching session resets the preference. It submits no actions, stores no
research events, invents no AI utterances and does not bypass server validation.
This is the guidance part of Demo Mode, NOT the complete shortened 3D demo or a
research result. Role introductions/cameras, live AI and physical-device demo
acceptance remain open. All 474 local root/court-tool regression tests (excluding
the separate dictionary corpus suite) passed; frontend check passed. New guide
browser/visual acceptance is still pending.
