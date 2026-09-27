# Court Client Protocol v1

Status: implementation contract, not a deployed API. Baseline API remains v0 at `/api/court/*`. No v1 capability may be advertised until its server endpoints, Unity adapter and integration tests exist. `court/protocol.js` is the executable JSON validation contract; `court/client-state.js` is the browser-side reference reducer. Unity typed DTOs, strict wire reader and reducer now exist in Assets/Scripts/Networking and Core. Shared fixture: Assets/Editor/Fixtures/court-v1.json. Runtime integration remains pending.

Unity's JsonUtility ignores unknown fields and defaults missing scalar fields. `Networking/CourtWire.cs` now validates the exact schema before deserialization and typed validation. Network adapters must use CourtClientState.AcceptSnapshotJson/AcceptEventJson. There is deliberately no SendMessage entry point accepting v1 JSON yet: exact origin/source/request correlation and runtime integration remain required. Do not wire unvalidated JsonUtility.FromJson output directly into this store.

The shared wire dialect rejects duplicate keys (including escaped spellings), unknown/missing fields, nulls and invalid Unicode. Numbers must be unsigned decimal integer tokens: no leading zeros, minus signs, fractions or exponents, maximum 9007199254740991; apiVersion must be exactly 1. Bounds: 262144 UTF-8 bytes, depth 12, 10000 values, 40 array items, 12000 UTF-16 units per string; field-specific limits are usually smaller. Shared negative edits live in Assets/Editor/Fixtures/wire-invalid.json. This validates syntax/projection only, not permission or truth.

## Transport and authority

The same-origin web shell owns authenticated HTTP, HttpOnly cookies and CSRF headers. Unity receives only validated public projections through a bridge that checks exact origin, iframe/parent window, channel generation and request identity. Session identifiers below identify a court game, NEVER an authentication token.

All strings are plain text; render with textContent or rich text disabled. Reject unknown fields, unsupported apiVersion, oversized payloads, invalid references and unsupported enum values. Validation protects format, not semantic truth: the server must project authorized data before serialization. Never serialize full server state and then remove a few secret keys.

## Envelope

Snapshot fields: `apiVersion:1`, `requestId` (UUID), `caseId`, `sessionId` (UUID), `stateVersion` (nonnegative safe integer), `eventId` (UUID), `eventSequence` (nonnegative safe integer), `timestamp` (UTC ISO milliseconds), `state`.

`timestamp` is the time of the last committed event, not the GET response time. Re-reading unchanged state preserves event identity and content. `requestId` correlates transport and may differ on a later GET. Every visible state change increments stateVersion and eventSequence exactly once. Event ids never repeat within a session.

State projection contains title, procedure, roleId, stageId, stageLabel, completed, visible evidence, allowedActions, visible NPCs and feedback. This deliberately excludes model prompts, hidden facts, correct answer indices, credentials, internal owner ids and private reasoning. Expanded fields require a reviewed contract change; do not loosen validators to arbitrary objects.

### Actions

Descriptor: `actionId`, `label`, `category`, `enabled`, `reasonDisabled`, `requiredTarget`. Categories: procedure/statement/evidence/objection/assessment/navigation. A disabled action must have a nonempty explanation. `requiredTarget` is none/evidence/npc. Action identifiers are server-provided, not a client stage switch.

Mutation: `apiVersion`, `requestId`, `idempotencyKey`, `sessionId`, `caseId`, `expectedStateVersion`, `actionId`, `targetId`, `text`. Both request IDs are UUIDs; the same logical attempt preserves BOTH on retry and its exact content. Server persists payload and result atomically with state/event. Same key with different payload is 409. Client must not assume an enabled action remains legal after network delay.

Server maps descriptors to validated typed payloads. The first v1 rollout must preserve v0 acknowledge/speak/review/rule/closeEvidence/answer/step capabilities; rule decisions and answer choices can be distinct descriptor IDs, not client-authored scores. Add lawful objection/withdraw/question/present capabilities to server engine before showing them.

### NPCs and evidence

NPC projection: npcId, roleId, displayName, seatId, pose, emotion, speakingState, visible, interactable, requestState. Pose allowlist covers idle/speaking/listening/thinking/objecting/presentingEvidence/sitting/standing/turnHeadToSpeaker; emotions neutral/nervous/confident/surprised. These map to deterministic local animations, never arbitrary Animator parameters. Request state idle/pending/failed is presentation only.

Evidence projection: evidenceId, title, type, text, metadata (bounded name/value list), sourceRole, admittedStatus, presentationState, factReferences, assetId. Only already-visible fact reference IDs may be included. Nine types: image/document/chat/timeline/audioTranscript/objectPhoto/mapDiagram/syntheticRecord/cctvStill. Asset IDs resolve via a trusted server asset catalog; not arbitrary URLs or executable markup. Forbidden evidence must not appear, including metadata/IDs revealing hidden evidence.

## Event and replay

Event: `apiVersion`, `requestId`, `caseId`, `sessionId`, `stateVersion`, `eventId`, `eventSequence`, `timestamp`, `kind`, `speaker`, `roleId`, `stageId`, `text`, `evidenceIds`, `citationIds`, `snapshot`. The embedded snapshot is the public view at that event, with exactly matching envelope identity. Kind: session_started/statement/npc_utterance/evidence_presented/objection/ruling/stage_changed/session_completed/checkpoint. Citations reference separately validated public source records (pending catalog implementation).

Proposed `/api/court/v1/sessions/:id/snapshot`, `/actions`, `/events?after=<sequence>&limit=<n>` retain existing owner checks. Events page is bounded, chronological and owner-projected; continuation cursor must be server validated. Endpoint implementation is pending. Do not synthesize an initial event from incomplete legacy request caches. Legacy sessions can begin at an explicitly marked checkpoint; UI must show replay starts at that checkpoint, not claim full history.

Replay reducer is a separate read-only instance. Jump rebuilds from authenticated recorded snapshots; never calls mutations, current-state transition rules or AI. Replay cannot add previously-hidden evidence based on its visibility today. A missing sequence pauses replay and requests missing data; never interpolates legal state.

Implemented source: `court/replay.js` is an independent read-only event store with
atomic pages (20 events), duplicate/conflict/gap validation, a 200-event/8 MiB bound,
play/pause/step/seek/event-ID jump, and historical transcript filters for role,
stage, evidence, kind and literal keyword. It accepts strict v1 events only and has
no fetch or mutation dependency. Getters return copies. Playback uses display pacing
(one event/second), not invented judicial timing; a long background frame advances
at most one event. A nonzero initial checkpoint explicitly marks an incomplete prefix.
Transcript only includes records through the playhead; historical snapshot evidence
is never merged with live evidence. The timeline UI and Unity replay presenter
remain unimplemented. Five Node tests in
`scripts/test-court-replay.mjs` cover these data-layer behaviors with synthetic events;
they do not prove a live full-session or Unity replay.

`court/replay-loader.js` implements same-origin GET-only loading from the existing
owner-checked `/api/court/sessions/{id}/events?after=...` route. It validates the raw
page with the bounded strict parser (including duplicate JSON keys), verifies the
cursor and server version, and appends pages atomically. Each page is capped at
262144 bytes; larger history pages fail explicitly rather than consuming unbounded
memory. A future server byte-aware pagination change is needed for unusually large
events. Loading is explicit, one page at a time, with no automatic retry. Timeout
includes stream reads; clear aborts and invalidates in-flight work. HTTP 401 clears
private history. Four mocked-HTTP tests cover these guarantees. The local workerd
check script also now exercises the loader and verifies replay leaves the recorded
mutation outcome unchanged; that extended script must be rerun before claiming
actual HTTP integration evidence for this loader. No production entrypoint imports
it yet.

## Synchronization and recovery

1. Bind store to sessionId+caseId after authenticated server selection. Capture its local generation with every async operation. Logout, account/session change and iframe replacement increment generation, cancel pending work and clear state. Generation is not authorization.
2. Reject malformed, wrong session/case/generation, lower stateVersion or lower eventSequence. Identical same-version public state/event is duplicate even when GET requestId differs. Same-version different content/event is conflict: retain current state and reload, do not silently merge.
3. Full snapshot may advance multiple versions after reconnect. Incremental event application must be contiguous in both counters. Never fill gaps using client rules.
4. Mutation timeout is indeterminate, not proof of failure. Disable duplicate submission, recover snapshot/result, and retry only the original idempotent request where supported. No automatic new requestId. AI provider calls must not be replayed because of a client retry.
5. 401: clear credentials/UI via shell and require login. 403: show permission error. 409: refresh, ask user to re-evaluate action. 429: bounded wait/retry-after, no purchases. 5xx/network/timeout: preserve existing state read-only and allow explicit recovery. Invalid payload: reject and show update/service error, no partial merge.
6. AI unavailable: server returns labeled safe prewritten content or an explicit failure event; procedure remains usable. No private `thinking` substitution. Snapshot response cannot turn a failed AI request into invented testimony.

## Other projections to implement before enabling capabilities

- Seat catalog: seatId, supportedRoles, cameraAnchor, standAnchor, interactionAnchor, accessibilityAnchor, animationAnchor; IDs refer to checked-in scene anchors. Role mapping server-controlled, not user JSON positions.
- NPC utterance: bounded text, utteranceId, NPC ID, emotion/gesture allowlists, speakingTarget, public citation references and above envelope. Confidence is optional educational UX, never a legal probability.
- Experiment assignment: server issues experimentId, variant, telemetryEnabled, researchOverlayAllowed; no client randomization. Juvenile restrictions enforced server-side irrespective of UI flags.
- Telemetry: allowlisted anonymous experiment id/case/role/stage/event type/timestamp/duration only; no raw dialogue, password, token, device fingerprint or hidden truth. Server determines collection; disabled by default before consent/policy.
- Demo: real server sessions and rules, shorter flow only. Do not fake successful API or derive a verdict in client.

## Acceptance and rollout

### Shell bridge implementation (not yet enabled)

`court/unity-bridge.js` owns the shell-to-frame command boundary around `CourtTransport`.
The shell binds an exact iframe WindowProxy and origin and issues a fresh UUID channel
for each binding. This channel is a lifetime discriminator, not an auth token. Clear
on logout, account change, iframe navigation/replacement and session change. Rebinding
aborts transport work and prevents old completions from reaching the new frame.

Frame commands have exactly: type (`court-v1-command`), apiVersion (1), channel,
sequence (positive monotonic safe integer), expectedStateVersion, actionId, targetId,
text. Reserved action IDs `refresh`, `recover`, `retry` invoke transport controls and
require empty target/text; other IDs are server descriptors. The shell rejects a
rendered action whose expected version differs from its current snapshot. Only one
command runs at a time; duplicates do not produce another HTTP request. Retries retain
the transport's original request and idempotency IDs, not frame-supplied identifiers.

Outgoing messages are `court-v1-bind` (sessionId/caseId), `court-v1-snapshot`
(sequence/payload containing validated snapshot JSON), `court-v1-result`
(sequence/status/canAct), and `court-v1-clear`; all carry apiVersion/channel and use
an explicit target origin. No credentials, transport objects or exception text cross
this bridge. Receiving Unity adapter must validate channel and use its strict reducer.

`court/unity-receiver.js` now provides the frame-side receiver with exact parent
origin/window checks, correlated command sequences, a validated public state store,
and explicit onSnapshot/onClear/onStatus callbacks. It cannot fetch APIs or read
credentials. Actions stay disabled until both a valid snapshot and correlated result
arrive. `scripts/test-court-unity-receiver.mjs` includes a paired shell/frame/transport
test with mocked HTTP and message delivery. Runtime Unity callback wiring, iframe
ready handshake remain pending; this source is not imported
by the production play page and is not a completed Unity integration.

The frame now has a 20-second delivery watchdog (bounded configurable timeout).
Expiry clears only the pending delivery marker, keeps the last view read-only and
reports timeout; it never creates a second mutation. Explicit `recover` asks the
shell for its persisted outcome, while `retry` retains the shell's original IDs.
Late results from the expired sequence are rejected. Clear/rebind cancels timers;
even an already queued old timeout cannot change a new binding. Delivery exceptions
produce a sanitized unavailable status. Tests inject a deterministic clock and cover
lost results, late results, recovery without a second action, timer disposal and
postMessage exceptions; actual browser background suspension remains unverified.

Evidence: `node --test scripts/test-court-unity-bridge.mjs` tests the real transport
with mocked HTTP/window delivery: origin/source/channel/shape/sequence rejection,
stale-view action rejection, in-flight rebind cancellation and 401 clearing. This is
NOT browser/Unity E2E evidence. No runtime imports or new WebGL artifact yet; wiring
the receiver, lifecycle hooks, NPC/evidence projections and preservation gates remains.

Shared protocol tests must reject malformed, extra/secret fields, unsafe IDs, cross-session data, duplicate IDs, missing references, stale/out-of-order/duplicate/conflicting snapshots and missing event sequences. Tests use synthetic public fixtures, not private user cases. C# must consume the same fixtures in real Unity. Backend must test transactional replay consistency, cross-account reads and idempotency before v1 activation.

Current v0 frontend and WebGL stay untouched until v1 end-to-end capabilities match the preservation matrix. Subsequent source changes now implement v1 snapshot/action/outcome routes with additive court_events and court_v1_requests tables. Local workerd validation is recorded in court-game/API-INTEGRATION.md. No production deployment has been performed. A schema or passing reducer test does not prove a deployed authoritative game or replay.
