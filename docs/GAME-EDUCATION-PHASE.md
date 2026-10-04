# Game / Education Phase — priority override, 2026-10-04

Status: in progress, not accepted. Latest user instruction takes priority over
nonessential backend expansion. Preserve the complete original Backend Goal and
`docs/BACKEND-GOAL-AUDIT.md`; resume all remaining items after this phase's acceptance.
Do not mark the Backend Goal complete or discard it. This is a sequencing change.

Latest priority clarification (2026-10-04): the user deferred educational-effect
evidence, pre/post-test, survey and research collection work. Preserve existing
modules and unfinished requirements, but now prioritize 3D evidence/NPC gameplay,
contradictions, animation, review and demonstration. Do not fabricate study results
or enable production collection while that work is deferred.

### Resumed gameplay verification — 2026-10-04

- Defense-role browser pass: local Chromium loaded the actual Unity WebGL frame,
  then used the host procedure panel to finish the authored tablet case through
  original statements, evidence discovery/presentation, contradiction follow-up,
  closing statement and final judgment (completed version 11, 12 saved events).
  Reload restored the same completed result, objectives and read-only review.
  NPC AI was disabled: the follow-up was explicitly labelled prewritten teaching
  material, not a live model success. Console warning/error capture was empty.
  This is not proof of all world-space interactions, all roles in browsers,
  physical mobile, full 3D replay or educational effectiveness.
  The pass found and fixed three presentation issues: prerequisite rejection no
  longer claims only a version change, refreshing an unchanged snapshot no longer
  claims an operation was saved, and replay player role IDs receive procedure-
  appropriate Chinese display labels. Recovery/authorization/state logic remains
  unchanged. Consolidated transport/action-panel/replay tests passed 28 tests;
  frontend checks passed. No research collection or backend expansion was added.
  The preceding six-role API commit f96ec7e also passed Fast CI run 37193603121.

- Multi-role runtime gate: `scripts/check-investigation-api.mjs` now exercises
  judge, claimant, respondent, claimantCounsel, respondentCounsel and observer
  against the actual loopback Worker, Durable Object RPC and SQLite. The five
  player paths include original statements, discovery, presentation, deterministic
  contradiction, labelled fallback follow-up, wrong-answer retry, debrief and
  immutable review. Counsel configurations explicitly select private assistance.
  Non-judges cannot issue the judge's procedural rulings. Observer is step-only,
  receives no invented player investigation or score and cannot submit player
  actions. All received events also pass the production JavaScript client reducer;
  saved events are loaded into the separate replay store and seeking cannot
  change the live client or persisted completed result. Receipt lookup is
  owner-only; exact retry produces one event, stale versions are rejected.
  The check preserves the real rate limit: only its explicit pre-mutation 429
  permits one bounded wait/retry with identical request data. Timeout and unknown
  outcomes are not blindly retried. Each successful run deletes only the six
  synthetic courts it creates; synthetic accounts remain in local test storage.
  Consolidated run passed all six role paths on the live local port 8798 Worker
  with NPC AI disabled. The related investigation/control/board/debrief/protocol/
  replay suite passed 24 tests, plus script syntax and diff checks. The existing
  Fast regression workflow runs this same expanded script on isolated workerd;
  its CI result must be checked separately after push. The preliminary run hit
  the real limiter and failed cleanup of one local synthetic court; the final
  bounded-wait run completed all six cleanups. No unrelated records were removed.
  This is one authored case, not all templates, Unity input, live AI or mobile
  acceptance. No deployed runtime, migration, research flag or Unity asset changed.

- Completed-court question review now displays existing owner-authorized saved
  questions alongside replies with honest AI/dictionary/scripted labels. It is
  separate from event replay because legacy question times/stages were not saved.
  Search, NPC filters, bounded pagination and account/session clearing are tested.
  Replay gains first/last-loaded navigation, position text and event-kind filters.
  Twenty concentrated tests pass; local Chromium restored the existing completed
  version-13 synthetic case, filtered its 14 events and searched the saved witness
  follow-up without changing the result. No new AI call or research collection.
  See REPLAY-UI-PROGRESS.md for limits; this is not complete 3D replay/mobile proof.

- In-game action-panel integration regression now proves the new comparison is
  mounted inside the procedure/evidence panel, only renders the same-version
  public board, clears before a changed session/account response, and issues
  GET-only requests while viewing. Seven panel/board/comparison tests pass.
  This uses the real transport with a synthetic HTTP/DOM adapter, not a claim of
  additional Unity input, mobile hardware or production acceptance.

- Added a read-only statement/evidence comparison to the investigation board.
  It renders only server-projected heard statements and discovered evidence,
  never imports hidden case definitions or decides contradictions. Completed
  courts explicitly remain read-only. Five comparison/board tests passed,
  covering missing discoveries, selection, clearing, stale callbacks, literal
  HTML-like text, unchanged source data and challenge-mode behavior. Rendered
  locally using the existing completed synthetic version-13 court; this is not
  mobile hardware, live AI or a new end-to-end court completion test.

- Fixed host camera commands resetting the walking player's position on every
  authoritative revision. Normal updates now preserve position; explicit view
  selection, a changed session/role/procedure and a ready/reloaded Unity frame
  still initialize the camera. Snapshot synchronization remains independent.
- Real local WebGL keyboard testing: walked to the judge desk, opened the panel
  with E and submitted the first procedure actions. Then walked to the evidence
  box, opened it with E, investigated the scene (server version 2 to 3), saw the
  newly discovered evidence and closed the panel without returning to spawn.
- Added camera-command regression tests. No Unity binary changes were required.
  This is desktop browser verification, not mobile-device acceptance. Live AI,
  complete NPC animation, full demo acceptance and remaining game requirements
  are not claimed complete. No educational-effect evidence was collected.

## Initial baseline and boundary (later verification entries below supersede this baseline)

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

Dialogue presentation correction (2026-10-04): `court/transport.js` now binds
the latest displayed utterance to its committed stateVersion. Advancing the
procedure or receiving a newer snapshot hides old speech; an older recovered NPC
receipt still resolves the pending operation but cannot replay stale speech over
the current view. Same-version refresh preserves the current utterance. Existing
event history remains intact for replay. Regression tests cover normal sequence,
refresh, late receipt recovery and logout; this does not claim live AI/Unity
acceptance or add new protocol/backend state.

WebGL browser checkpoint (2026-10-04): local authenticated completed investigation
loaded the existing Unity binary to 100%, entered the scene and rendered role
characters/robes, crosshair and version-13 completed HUD. Inspection found nested
scrolling: main's fixed 320px minimum plus header exceeded the iframe viewport.
Both published HTML and Unity template now use a viewport-height flex column,
shrinkable main and scrollable cover. Reload/resume/start in the real in-app
browser removed the inner scrollbar while Unity remained visible. No binary,
resolution or input logic changed. This is NOT evidence-box/E interaction,
physical-mobile, complete gameplay, live AI or production acceptance. Docker
rebuild remains required when publishing the changed shell.

Docker handoff checkpoint (2026-10-04): the above rebuild is now completed for
source `c41ad630e61d3c17a2e4cb25c30a94cc31a9fb9d`. GitHub Actions
https://github.com/1ch666/eduai2/actions/runs/37175438713 succeeded on the existing
public-repository standard Ubuntu runner: real Docker build/run, nginx config,
both game URLs, selected court-module and all Build resource byte comparisons,
API 501, missing-route 404, non-root user and read-only filesystem checks.
Fast CI 37175362296 and Pages 37175362045 also succeeded for that source.
The downloaded `outputs/docker-c41ad63/` handoff has all six SHA256SUMS entries
verified locally. Image archive SHA256:
`da1e32a9daca1cf9a5dd990f9eca97ba1ec3b7035098a2b53e7d8daad8105673`.
GitHub artifact retention is one day; the local copy is retained outside Git.
This is a static Linux amd64 game image, not the Worker/DO/session/AI backend;
Cloudflare publication and full game/education acceptance are still pending.

Replay usability increment (2026-10-04): role, stage and linked-evidence filters
in `court/replay-panel.js` now use selectors derived solely from the played event
prefix; keyword search is preserved. Stage labels come from historical public
snapshots, and current evidence titles replace raw IDs when available. Rewinding
removes future options and clears invalid selections; close/logout removes the
options. Tests verify forward/back navigation, no future-role/evidence disclosure,
text-only rendering and GET-only replay. No server mutations or protocol change.
Local browser verification of these selectors passed: selecting the witness at
the final event shows its three related records; rewinding to the first event
removes future role/evidence choices and resets the selection. Physical-mobile
verification remains pending.

Replay text checkpoint (2026-10-04): real browser inspection found raw `lawyer`,
`evidence_presented` and procedural command IDs in the replay. The panel now
labels the role/event in Chinese. For procedure/ruling/completion events only,
display text resolves the exact command against enabled actions in the preceding
public historical snapshot. Raw events and dialogue remain unchanged; missing
history retains original text instead of guessing. Search supports the displayed
label and original text. Seven focused replay tests and frontend checks passed.
Reloading the completed local version-13 case verified Chinese final judgment,
rulings and procedure labels in the real browser. This uses synthetic local data
with AI disabled, not participant research or live-provider acceptance. No Worker,
database, API contract or Unity binary changes in this increment; production
publication and full Game/Education acceptance remain pending.

Hint-difficulty presentation increment (2026-10-04): the authenticated procedure
panel now offers tutorial/normal/challenge modes for the authored investigation.
Tutorial adds operation guidance; normal retains basic hints; challenge hides
the explicit hint button, demo guide, contradiction target checklist and numeric
contradiction summary. Discovered facts, lawful operations, final judgment and
server scores do not change. The outer notebook uses the same preference. Mode
resets on context clear/reload, is not cloud-persisted and is not an experiment
assignment or ranking property. The UI explicitly states these limitations.
Tests cover stale hint-button callbacks, unchanged source snapshots, preserved
judgment and counts restored in normal mode. All 480 local root/court-tool tests
(excluding dictionary corpus suite) and frontend checks passed. Real local
browser verified the selector and challenge presentation on the completed v13
synthetic case without advancing its version. Active-case mode switching,
physical-mobile acceptance and research integration remain pending; this is not
completion of the whole difficulty/research requirement. No backend/schema,
Unity binary, formal data or Cloudflare deployment changed in this increment.

Active-case difficulty correction (2026-10-04): inspection found the outer shell
still offered AI guidance and speech while the investigation panel was in
challenge mode. `guidance-presentation.js` now synchronizes those controls,
cancels ongoing hint speech when suppressed and rejects delayed guidance after
owner/session/version/mode changes or context clear. Completed review and legacy
cases retain guidance. This is presentation only, not a server permission rule.
Nine focused tests and frontend checks passed. A new synthetic local case was
created through the real browser; switching to challenge and closing the panel
hid all outer guidance controls while preserving opening actions and version 0.
Live provider latency, full active-case completion under every mode and mobile
acceptance remain unverified. No production data or deployed Worker changed.

Challenge end-to-end browser checkpoint (2026-10-04, source 9b3451b): the synthetic
local case created at 04:17:55.475Z was completed through visible browser controls,
using challenge presentation from opening through final judgment. Observed
versions: 0 opening; 1 acknowledgement; 2 statement; 3 prosecutor original;
4 witness original; 5 defense original; 6 scene evidence; 7 presentation to
witness; 8 unlocked follow-up; 9/10 procedure rulings; 11 close investigation;
12 final statement; 13 final judgment/completed. Before discovery no evidence
title/presentation action appeared. Follow-up appeared after presentation and
disappeared after its committed response. Hint controls stayed absent while
normal legal operations remained usable. The fallback was visibly labelled
prewritten, not represented as live AI. Debrief showed 100% evidence/NPC/procedure
coverage, zero recorded hints, actual selected judgment and the authored reasoning
review; numeric contradiction summary stayed hidden in challenge mode. These
are synthetic QA results, NOT education-effectiveness measurements.

Read-only replay opened at version 0 and reached version 13; after closing it the
live case still displayed completed version 13. This verifies the browser
procedure-panel path, not Unity movement/E-box/touch interactions, live AI,
physical phones, cloud publication or formal participant research. No formal
user experiment has been performed. The broader Game/Education phase and all
original Backend Goal Audit obligations remain open.

Debrief classification increment (2026-10-04): completed investigation views add
`debrief.errorAnalysis`, an array of `{code,label,status,basis}`. Status is
`observed`, `not_observed`, or `not_assessed`; absence of an observed error is not
proof of competence. Existing discovery/question/contradiction state supports
recorded omissions. The existing final-attempt count supports judgment retries,
not the semantic reason for a wrong answer. Fact-vs-inference, procedure errors,
single-testimony reliance and legal-concept errors remain explicitly unassessed
until suitable recorded evidence is integrated. No LLM/text keyword scoring.
Observer mode is unassessed and no longer labels the template answer as a player
judgment. Existing persisted state, API version, scores and migrations remain
unchanged. The additive legacy public-view field is not part of the strict Unity
v1 snapshot. Old frontends ignore it; new frontends tolerate its absence, allowing
rollback without data conversion. Court/board/debrief tests verify all roles,
retry propagation, invalid/missing attempt counts and unchanged source state.
Production deployment and real-browser rendering of the new classification are
still pending; this does not complete the full error-analysis/research requirement.

Debrief runtime checkpoint (2026-10-04): the real loopback Worker/DO integration
test now submits one wrong judgment, verifies the case stays unfinished with no
debrief, then corrects it. Completed output records two attempts as a retry,
keeps unsupported semantic categories unassessed, and exposes only the four
documented fields per classification. Existing owner/CSRF, duplicate recovery,
completion and read-only assertions all passed. The script removes only its own
new synthetic local case afterwards; formal data was not touched. A browser
reload of a previously completed one-attempt case rendered all eight categories,
including the four explicit insufficient-data explanations, at unchanged version
13. No migration was required. This replaces the pending local classification
rendering check above; live AI, production publication and human research remain
unverified.

Docker refresh (2026-10-04): source
`70237021f01f37b7d8be87e479824b15e470eab0`, workflow
https://github.com/1ch666/eduai2/actions/runs/37177242113 succeeded. The workflow
now compares every court JS/CSS/HTML asset to the running image, includes new
hint/replay tests, and bundles this phase guide. Existing WebGL resource byte
checks, nginx config, API 501, missing-route 404, non-root and read-only checks
passed. Downloaded to `outputs/docker-7023702/` (not committed); all seven
SHA256SUMS entries verified. Image archive is 46,601,103 bytes; SHA256:
`501eda4f7b0fa9a53cd892c19edbab4962064b96b9dd200aa3d74964784b1a03`.
This supersedes c41ad63 as the newest verified static container, not as a Worker
deployment. Authentication, session, AI and DO storage are not in this image.
Artifact retention remains one day; the local copy is retained for handoff.
CI also reported upcoming Node-action/runtime and Ubuntu-label migration
warnings; these were not build failures and have not been represented as fixed.

Education instrument scaffold (2026-10-04):
`src/court-education-instrument.ts` contains the original, versioned
`court-reasoning-draft-1` pre/post forms (three questions each) and four fixed
Likert survey items. Server-only scoring checks the trusted host phase, exact
version/question IDs and bounded integer answers. Public output excludes answer
keys; survey input rejects identity fields and free text. This is an unvalidated
teaching draft, NOT a validated research scale or proof of educational benefit.
The paired forms have not been checked for equivalent difficulty by experts.

This module is NOT connected to HTTP routes, the court UI, storage or telemetry.
Existing learning-event store/scheduler infrastructure is not a consent flow.
No participant collection has been enabled. Before integration:
- Obtain explicit, optional consent with withdrawal and retention explanation;
  declining research must not block ordinary gameplay.
- Derive pre/post eligibility from server session progression, not client phase;
  pre-test precedes play, post-test follows authoritative completion.
- Commit first submissions with existing owner, CSRF, version, journal and
  recovery protections; retries must not overwrite scores or count twice.
- Return only the currently eligible form; do not reveal pre-test scores or
  answer feedback before post-test submission.
- Keep research identifiers separate from public account/display information;
  bound retention and deletion, and never store prompts, tokens or private truth.
- Associate game metrics with actual authoritative events; do not manufacture
  completion times or treat synthetic QA sessions as participant observations.
- Have an education expert review the questions and study design before using
  results to claim learning effectiveness.

Focused tests cover answer-key omission, detached public data, phase/version
validation, bounded scores/ratings and rejection of extra fields/accessors.
尚未進行正式使用者實驗。The full Game/Education acceptance remains open;
the original `docs/BACKEND-GOAL-AUDIT.md` goals are retained, not cancelled.

Education progression increment (2026-10-04): `court-education-flow.ts` now
implements the pure server-side sequence off -> consent/pre -> playing -> post
-> survey -> complete. Trusted case progression gates enrollment and post-test;
expected revision rejects stale transitions and each submission is accepted only
once. Withdrawal clears all assessment scores/ratings and prevents reenrollment
in that flow. Public projection reveals only the eligible form and delays scores
until post-test submission. Unit tests cover the complete sequence, skipping,
late enrollment, stale/repeated writes, wrong forms and withdrawal at every phase.
This reducer is not yet wired to a durable host: transactional persistence,
request recovery, owner checks, deletion of any exported copies, consent UI and
retention remain integration work. It does not enable research collection or
change production storage. Ordinary gameplay must remain available without consent.

Persisted education boundary check (2026-10-04): `parseEducationFlow` validates
exact stored fields, instrument version, bounded scores, phase/revision agreement
and the presence/absence of pre/post/survey data. Transitions and public views
now use this validation instead of trusting a TypeScript cast. Invalid state
is rejected rather than reset or exposed. Parsed state is detached so later
transitions cannot mutate earlier score objects. Seven assessment tests and
TypeScript checking passed, including corrupt JSON shapes, extra fields,
accessor rejection and detached-state regression. Durable storage and UI
integration remain pending; no participant data or production schema changed.

Education storage adapter (2026-10-04): `court-education-store.ts` now provides
per-session SQLite persistence and atomic state/receipt commits. Validated
commands use UUID request IDs and expected revisions; receipts retain a SHA-256
command digest and applied revision, not raw answers. Duplicate recovery returns
the current public view plus the original applied revision, not a stale view.
Authoritative case progress is read inside the transaction after digesting.
Withdrawal removes state and receipts, retaining only a scope/schema withdrawal
guard so delayed work cannot recreate data. Corrupt payloads do not block erasure.

SQLite tests cover all assessment phases, recreation, concurrent duplicates,
changed-body conflicts, stale case progress, transaction rollback and withdrawal
while a request is in flight. These use Node SQLite, not deployed workerd or
human participants. Collection defaults disabled. The adapter is NOT wired into
CourtRoom, routes or UI, and no production schema was changed. Integration must
still supply authenticated ownership/CSRF, consent UI, retention alarms, case
deletion/backup handling and workerd tests. Initialization adds three new tables
only; rollback may leave them unused, but an eventual collection rollback must
keep authorized erasure and retention available. Request hashes are not a claim
of anonymity or encryption. No formal user experiment has occurred.

Education retention increment (2026-10-04): the internal adapter adds an
`education_expiry` table and a fixed 30-day deadline starting at consent. This is
an implementation default awaiting disclosure in the consent UI, not a legal
retention determination. Reads, initialization, mutations and explicit `prune`
erase overdue assessment state, receipts and deadline in one transaction; the
withdrawal guard prevents late work from reviving them. Retries do not extend
the deadline. Tests exercise expiry boundaries, delayed digest completion,
rollback on erase failure, and legacy data lacking a deadline (reject without
reset; authorized withdrawal remains possible). No production migration ran.
This is access-time expiry plus an internal maintenance method, NOT a scheduled
deletion guarantee: the owning DO alarm still needs wiring and runtime testing
before research collection can be enabled. Existing backups/exported copies
also need the documented retention/withdrawal policy applied during integration.

Court deletion integration (2026-10-04): both existing legacy and v2 deletion
paths now erase optional education state, request receipts and expiry rows in
the same court deletion transaction. A minimal withdrawal guard remains to
reject an assessment request already awaiting its digest. Old rooms without
education tables remain deletable; deletion does not create those tables.
The actual CourtRoom Node/SQLite suite passed 79 tests, including unauthorized
deletion, injected education-erasure rollback, both deletion paths and pending
assessment completion after deletion. This integrates cleanup only, not the
education API or collector. No production data was removed. Background alarm
delivery and education UI/authenticated endpoint integration remain pending.

Education alarm adapter (2026-10-04): `court-education-scheduler.ts` wraps store
operations and alarm changes in one asynchronous storage transaction, following
the existing learning-event scheduler pattern. It requires exclusive ownership
of the enclosing DO's alarm. Initialization is explicit, not scheduled from a
constructor before pending alarm delivery. Tests use Node SQLite with a simulated
transactional alarm to verify fixed expiry after recreation, cleanup without a
player request, failed scheduling/cancellation rollback, withdrawal and queued
duplicates. Three scheduler tests and type checking passed. This is NOT proof of
actual Cloudflare alarm delivery: CourtRoom integration, authenticated routes,
consent UI and workerd alarm validation remain required. No new binding, migration,
production alarm or research collector was enabled.

CourtRoom education host integration (2026-10-04): the internal `education` RPC
now checks the stored owner and supports view/apply/withdraw for the authored
tablet investigation (not generated or observer cases). The optional
COURT_EDUCATION_ENABLED flag is absent/disabled by default; it was not added to
deployment configuration. Existing assessment data remains viewable and
withdrawable if the flag is later disabled. Court progress is read from stored
server state, never accepted from the caller; assessment revisions do not alter
court versions, verdicts or journal entries. Authorization is checked again
inside queued transactions and after asynchronous work. CourtRoom now forwards
its otherwise-unused alarm to assessment expiry cleanup only when tables exist.
Ordinary rooms do not create research tables, and alarm delivery never opts in.

Verification: 82 CourtRoom Node/SQLite tests and four scheduler tests passed,
plus TypeScript checking. Coverage includes default-off behavior, cross-owner
rejection, withdrawal while disabled, overdue cleanup and deletion before queued
initialization. Scheduler tests verify authorization loss rolls back writes.
These use simulated transactional alarms, NOT actual Cloudflare alarm delivery.
Authenticated HTTP routes, consent/pre/post/survey UI, actual workerd/alarm
validation and formal user testing remain pending. No production deployment,
research enrollment or participant results are claimed. No production data,
credentials, bindings or migrations were changed. The original Backend Goal
Audit remains deferred until Game/Education acceptance, not removed.

Authenticated education transport (2026-10-04): the existing v2 router now serves
GET/POST/DELETE `/api/v2/court/sessions/{id}/education`, with existing session
resolution, write CSRF/origin checks, bounded UTF-8 input and per-learner court
rate limiting. Owner identity comes only from the authenticated session. Added
a machine-readable response schema and `docs/COURT-EDUCATION-API.md` describing
commands, recovery, withdrawal and privacy. Assessment wire parsing now rejects
duplicate keys rather than silently accepting JSON.parse's last value.

Verification: 509 local tests passed (root scripts and court-game tools,
excluding the separate dictionary corpus test), plus TypeScript checking.
This working-tree run includes the user's preserved uncommitted Ollama and
groups fixes; those files are NOT part of this change's commit. Route fixtures
cover auth/CSRF/rate/body/encoding/status mapping; SQLite fixtures validate
every accepted assessment phase against the response schema and reject added
answer-key/private fields. No real participant data was collected. The optional
flag remains unset; consent/withdrawal UI, actual workerd end-to-end/alarm
validation, formal user testing and production deployment are still pending.

Education presentation component (2026-10-04): `court/education-panel.js` now
renders voluntary opt-in, server-projected pre/post forms, four-item survey,
server scores, disabled/withdrawn states and explicit withdrawal confirmation.
Consent is unchecked by default and describes account-linked storage (not
anonymous), the 30-day limit and no ranking/efficacy claims. The component has
no network, persistence, scoring or automatic enrollment. Generation guards
reject callbacks from cleared/replaced screens; one dispatch per render prevents
double submission. All content uses text nodes, labelled controls and fieldsets.
Four Node presentation tests passed, including the complete sequence driven by
the actual deterministic flow module. This is an unmounted component, NOT a
released user flow: authenticated HTTP client/recovery, court host wiring,
rendered browser/mobile verification and consent review remain pending. No
Cloudflare flag was enabled and no user experiment was conducted.

Education browser transport (2026-10-04): `court/education-client.js` now calls
the authenticated same-origin v2 assessment endpoint with bounded response
reading, deadline cancellation, owner/session-context clearing and strict public
view validation. It never imports server answer keys. Unknown POST outcomes
remain pending; explicit retry reuses the identical request ID/body. A GET can
reconcile advancement but a same-revision read does not prove a pending POST
failed. No automatic write retry, browser persistence, credentials in payloads
or client-side scoring is introduced. View getters return detached copies.
Four transport tests plus four presentation tests passed, covering lost replies,
exact retry, context changes, timeout, hidden-field/early-score rejection,
oversized responses, withdrawal and login loss. The transport is not yet wired
into the court page. Pending commands currently live only in memory; host wiring,
reload recovery review, rendered browser testing and actual workerd verification
remain unfinished. No production deployment or research collection was enabled.

Court page education wiring (2026-10-04): the authored tablet non-observer
session now contains a collapsed optional assessment section backed by
`education-host.js`. Rendering/opening a court does not send a research request;
the user explicitly checks availability and separately opts in. Host wiring
exposes GET refresh, exact pending-command retry and withdrawal, clears on
navigation/logout/account-form submission/pagehide, and rejects late results
after a changed account/session context. The normal court workflow is not gated
by participation. Eleven host/client/presentation tests and frontend checks
passed; these are synthetic DOM/HTTP tests, not real-browser acceptance.
Actual rendered/browser/workerd/reload-recovery validation, consent review and
formal participant testing remain unfinished. Collection remains default off;
this commit was not deployed to Cloudflare and does not claim study completion.

Actual workerd education API check (2026-10-04): added loopback-only
`scripts/check-education-api.mjs`. On an isolated local Wrangler 4.136.3 server
at port 8798, consent, pre-test, exact duplicate receipt, owner isolation, CSRF,
rejection of false court completion, withdrawal/repeated withdrawal and deletion
all passed through real Worker HTTP -> Durable Object RPC -> SQLite. This caught
a runtime difference missed by the original Node fixture: a bodyless DELETE can
have a non-null empty stream. The handler now checks zero actual bytes using the
bounded reader, still rejecting nonempty bodies. Seven v2 regression tests and
type checking passed after the fix.

Run with an isolated persist directory and local-only bindings, flags
`--var COURT_AI_ENABLED:false --var COURT_EDUCATION_ENABLED:true`, then
`node scripts/check-education-api.mjs http://127.0.0.1:8798`.
The test creates synthetic accounts and deletes only its own synthetic court;
it does not clear unrelated records. A documentation-range synthetic network
address separates local rate buckets; the helper refuses non-loopback targets.
Earlier attempts on port 8794 hit overlapping existing listeners and are NOT
counted as current-runtime validation. No old user process/data was removed.
The successful test is not a browser/Unity test, post-test/full-court end-to-end
test, alarm-delivery test, production deployment or human education experiment.

Full local HTTP education/court sequence (2026-10-04): extended and reran
`check-education-api.mjs` against the live isolated port 8798 Worker. It now
completes the authored investigation through actual versioned court actions:
three NPC statements, evidence discovery/presentation, deterministic
contradiction follow-up, rulings and final judgment. Only after stored court
completion does the assessment advance to post-test and survey. Public API
schemas and browser projection validation pass for returned assessment views;
scores remain absent before post-test submission, survey ratings do not appear
in responses, an exact repeated post-test returns DUPLICATE, and fresh GET
restores the completed assessment. The complete court view is compared before
and after assessment/withdrawal to prove unchanged results. NPC AI is checked
disabled before starting; scripted responses are explicitly identified.
This supersedes the earlier limitation that the local HTTP check stopped at
pre-test. It remains synthetic API evidence, NOT rendered browser/Unity input,
real mobile, automatic alarm delivery, live AI, production or participant evidence.
The test deletes only its own synthetic court in finally; no production data or
settings were changed. Browser acceptance and all original phase gates remain.

## 2026-10-04 deadline batch — implementation in progress, NOT accepted

The user deferred educational-effect evidence and requested one consolidated
test pass after implementation. Do not enable research or treat this change as
phase completion. Current uncommitted game changes include:

- Server cast: authored witness nervous posture only after the confirmed public
  time contradiction, cleared after follow-up/stage exit/completion. This is not
  a credibility or guilt signal; no LLM-derived emotion or hidden-fact cue.
- Unity dialogue: bounded local listening/waiting/reply gestures, separate from
  authoritative snapshots; history/fallback/error do not simulate a new AI reply.
  Close, timeout, revoked visibility and disabling clear the activity.
- Demo guide: optional navigation shortcuts focus investigation, procedure,
  statement or read-only review inside the game panel. No action is submitted,
  NPC/answer selected or result changed by the shortcut. Re-render invalidates
  stale callbacks; recovery disables shortcuts; challenge mode retains no guide.

New/updated tests were authored, not run for the final batch. The earlier
86-test pass predates the final snapshot-contract fixture correction and Unity
dialogue changes. The successful WebGL revision 5f1234cfe7c9464f predates the new
dialogue layer and is not a deployable proof for these sources. Consolidated
verification must include Node tests, TypeScript, actual Unity Scene/Play/build,
hosted scene interaction and restoration, then matching deployment/Docker.
Current production assets and unrelated collaborator edits remain untouched.

Consolidated validation update: the selected 111 Node tests and TypeScript pass;
the added reduced-motion preference test also passes (template suite: 9 tests).
Frontend checks pass. Official Unity 6000.6.2f1 Scene/Play exits 0 with both
success markers in outputs/deadline-game-batch-play-20261004.log, including new
dialogue activity and reduced-motion rig assertions. The known Editor search
database exception remains. Release WebGL exited 0, revision bc51d418e668aff3;
matching assets replaced play/ after Gzip/revision/loader and size-budget checks.
Payload total is 21,335,111 bytes (+6,174 vs the prior published build).
Local Chromium loaded both guest and same-origin hosted scenes; restored the
existing synthetic version-3 case and switched overview successfully. Demo
navigation focused the investigation SECTION without changing the version or
submitting an action. Reduced-motion checkbox was usable. No console error/warn
was captured. This is bounded integration evidence, not live AI, full role flow,
mobile hardware, education-effect evidence or overall phase acceptance.
Publication and Docker results are recorded in RELEASE-2026-10-04-GAME.md.
