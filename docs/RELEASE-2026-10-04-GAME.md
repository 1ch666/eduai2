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
Deployment, CI, Docker and public asset verification results will be recorded
below after actual completion. Do not infer success from this planned checkpoint.
