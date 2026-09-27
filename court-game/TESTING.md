# Game client verification

## Current v1 foundation

Not connected to deployed game. Existing gameplay remains unchanged.

- `node --test scripts/test-court-protocol.mjs`: strict wire validation and browser reducer, shared nested Chinese fixture, nine evidence type tags, duplicate/stale/conflict, old-generation rejection, event gaps and separate replay store. This is not an actual replay service or UI test.
- Unity 6000.6.2f1 batch entry `EduAI.Court.Editor.CourtProtocolTests.Run`: compile, typed DTO validation, JsonUtility roundtrip, input/output clone isolation, state/version/generation checks, duplicate event, sequence gap and evidence references. Real Editor custom assertions, not NUnit PlayMode tests.
- Shared fixture lives in `Assets/Editor/Fixtures` and is excluded from player content. No private user data is used.

Run Editor with `-batchmode -nographics -quit -projectPath <isolated project> -executeMethod EduAI.Court.Editor.CourtProtocolTests.Run -logFile <log>`. Require BOTH process exit 0 and `COURT_PROTOCOL_TESTS_PASSED`; absence of exceptions alone is insufficient.

Local evidence (2026-09-26, rechecked 2026-09-27): both the first compile/reducer run (outputs/protocol-unity.log) and shared-fixture rerun (outputs/protocol-unity-shared.log) exited 0 with COURT_PROTOCOL_TESTS_PASSED. The latter log also records Unity's return code 0. These are workspace-local logs, not published CI evidence. Logs may contain Editor shutdown/network diagnostics; do not claim a warning-free run. Node shared-contract tests: 6 passed on 2026-09-27.

## Required next gates

Actual bridge transport correlation/timeout/retry; server event transactions and visibility projection; real Unity PlayMode presenter/scene tests; WebGL build and HTTP resource sanity; Chrome/Edge full flows; iPhone Safari and Android Chrome real devices; measured load/FPS/memory. None of these is established by the foundation tests.

## Strict wire reader — 2026-09-27

CourtWire validates raw snapshot/event/mutation JSON before JsonUtility. Shared wire-invalid.json contains 17 negative edits covering missing/extra/duplicate/escaped duplicate fields, types, invalid Unicode, unsafe numbers and version overflow. Node and Unity execute the same edits. Additional checks cover UTF-8 size, malformed nesting, trailing data, valid surrogate pairs and rejected input preserving current state. This is a closed protocol reader, not a general-purpose JSON library; see API-CONTRACT-UNITY.md for limits and integer token restrictions.

Node: 7 tests passed. Real Unity 6000.6.2f1: outputs/protocol-wire-final.log records COURT_PROTOCOL_TESTS_PASSED and exit 0. No scene or WebGL build was replaced; no real transport, browser or mobile acceptance is implied.

Existing `CourtSmokeTests`, `CourtPlayTests` and tools/test-*.mjs must remain and run before replacing scenes or player builds. CI currently does not compile Unity or establish a license. Its Docker job cannot be reported as C# or phone validation.

## Shell transport — 2026-09-27

`node --test scripts/test-court-protocol.mjs scripts/test-court-transport.mjs`: 17 tests pass. Injected-fetch tests cover matching request IDs, stable retry bytes, timeout (including stalled body), stream cancellation, logout cancellation, 401/403/409/429/500, retry cap and recorded-outcome recovery without another POST. The test clock/short timeout is not a real 500ms/2s/10s network or browser chaos test. No real v1 server exists yet. API-INTEGRATION.md lists endpoint requirements and remaining reload/bridge work.
