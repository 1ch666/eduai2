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

## First implementation checkpoint

`src/court-investigation.ts` now has the authored time-discrepancy definition,
deterministic view/question/present/follow-up/hint transitions and an allowlisted
Evidence Board projection. It rejects unavailable/unviewed evidence, invalid
roles/NPCs/stages, undiscovered follow-ups and mutations after completion.
Repeated discovery/follow-up does not duplicate their state. The initial board
does not publish the hidden evidence title or total contradiction count.

Two focused tests and TypeScript check pass. This module is **not yet connected**
to CourtRoom persistence, command recovery, NPC knowledge projection or Unity.
It is not a playable/released feature. Next integration must bind it to the exact
new authored case ID, validate persisted state, record the actually delivered
authored statement before marking it heard, compose the existing action validator,
commit through the existing journal/version/idempotency path, and feed presented
evidence through Knowledge Projection before a model call. Hint retry counting
must use the same receipts as every other mutation. Do not expose private
definitions, use an arbitrary frontend context, or infer facts from model output.
