# Game / Education checkpoint — 2026-10-04

User requested finishing the current camera issue, publishing this checkpoint,
then stopping development until they explicitly return. The Game/Education
and original Backend Goal requirements remain open; this is not phase completion.

## Camera fix

Host camera buttons now send explicit focus intent. The trusted, validated
WebGL message handler restores canvas focus without Pointer Lock or scrolling.
Automatic snapshot updates do not take focus from NPC text fields. The published
shell and Unity build template are both updated; no C# or Build binary changed.

Local Chromium, real existing WebGL: restored completed synthetic tablet case
(version 13), loaded to 100%, started, then switched overview and role seat using
only the outer buttons. Both rendered immediately without an extra canvas click.
Readonly completion stayed at version 13. Thirteen template/touch checks passed,
including untrusted source/origin, invalid camera fields, non-boolean focus and
background-sync rejection. This is not mobile hardware or full gameplay acceptance.

## Release boundary

Publish only committed source. Existing unrelated worktree changes to README,
groups and Ollama comments/tests are preserved and excluded. Committed Ollama
already uses `redirect:'manual'`; do not revert it. Deploy with existing bindings,
secrets and dashboard variables retained, no paid services or data reset.
Voluntary research collection stays at its existing production setting (default
off); synthetic local pre/post results are not research findings.

Previous Worker rollback version: `0215495e-d5a6-47d8-b2dc-e67682683617`.
## Actual release results

- Source: `d1cbe5ea54160f2e1de28d57dfeb4bc20bb3cd76` (main).
- Fast regression checks `37181925780`: success, including isolated workerd
  investigation and complete court/assessment lifecycle gates.
- GitHub Pages build/deployment `37181925503`: success, main/root source.
- Court Docker handoff `37181949587`: success, actual build/run and HTTP checks.
  Downloaded `outputs/docker-d1cbe5e`; all seven SHA256SUMS entries matched.
  Image archive SHA256:
  `0ae45ad235808e475640b69752b2d2bdb5ba8c24a98f468f65f55a6798deea1e`.
- Worker version `3750726a-8d39-4b1e-81e4-f5be7102f69b`: deployed successfully
  from an isolated git archive of that commit after TypeScript and dry-run passed.
  Existing bindings and schedule unchanged; `--keep-vars` used; no secret writes,
  new migration configuration, data reset or paid service activation.
- Worker `/court/court.js`, `/court/education-host.js`,
  `/court/investigation-board.js` and `/play/index.html` matched the release
  copy byte-for-byte. Anonymous auth returns `user:null`; capabilities respond
  successfully. AI configured/canAttempt does not prove a live model response.
- Production browser `/court/` rendered the new tablet investigation template
  and normal login entry. No production account or research records were created.
- Direct Pages resource verification remains inconclusive: repeated connections
  reset in Node, curl, PowerShell and the browser; one HTTP 200 script response
  did not match the release hash. Could not distinguish edge cache from other
  response differences. Do not claim Pages public bytes were verified merely
  because its deployment job succeeded. Worker public bytes are verified.

Camera proof: `outputs/camera-fixed-20261004.jpg` (local synthetic readonly case).
No browser error/warn captured in that check. No new C# build was required;
the existing Unity binary is unchanged. Docker still excludes the live backend.

Development is paused at the user's request after this release. On explicit
resume, first check Pages public asset freshness, then continue the existing
Game/Education acceptance gaps before returning to Backend Goal Audit. Do not
claim formal human experiments, full mobile acceptance or phase completion.

Resumed at the user's explicit request later on 2026-10-04. Pages direct HTTP
checks now return 200 and exact source equality for `court/court.js` and
`play/index.html` against released commit d1cbe5e. The earlier connection/freshness
uncertainty for those two files is resolved; no Pages settings were changed.

## Follow-up release: preserve walking position

- Source `ada6f148f008be72fe7330a2e29bf60d790f95de`: prevent routine server
  snapshot refreshes from repositioning the player; explicit view selection and
  iframe initialization remain supported. Local WebGL evidence-box interaction
  and eight targeted regressions passed (see GAME-EDUCATION-PHASE.md).
- Fast checks `37188759647`, Pages deployment `37188759445`, and Docker handoff
  `37188839044` all completed successfully.
- Worker version `a6cc4b4d-cc9f-4370-8763-8bfc331bf900` deployed from an isolated
  archive of the source commit. Type generation, TypeScript and dry-run passed
  after allowing the build subprocesses; the initial restricted run produced
  incomplete DO types and was not used for publication.
- Rollback version: `3750726a-8d39-4b1e-81e4-f5be7102f69b`.
- Worker `court/court.js` and `court/scene-view.js`: HTTP 200 and byte equality
  to the release archive. Pages equivalents: HTTP 200 and source equality after
  CRLF/LF normalization (the initial byte comparison differed only by newlines).
- Docker downloaded to `outputs/docker-ada6f14`; SOURCE_COMMIT matches and all
  seven SHA256SUMS entries verified. The image remains a static preview, not a
  bundled production login/AI backend.
- No backend source, secrets, database migration configuration, bindings,
  payment settings or research collection setting changed. Existing unrelated
  worktree edits were excluded. No C# or Unity binary rebuild was necessary.
- Educational-effect evidence collection is deferred at the user's request;
  remaining game acceptance and Backend Goal Audit requirements remain open.
