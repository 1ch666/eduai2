# Court Client Protocol v1

Status: implementation contract, not a deployed API. Baseline API remains v0 at `/api/court/*`. No v1 capability may be advertised until its server endpoints, Unity adapter and integration tests exist. `court/protocol.js` is the executable JSON validation contract; `court/client-state.js` is the browser-side reference reducer. C# DTO parity and runtime integration are pending.

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

Shared protocol tests must reject malformed, extra/secret fields, unsafe IDs, cross-session data, duplicate IDs, missing references, stale/out-of-order/duplicate/conflicting snapshots and missing event sequences. Tests use synthetic public fixtures, not private user cases. C# must consume the same fixtures in real Unity. Backend must test transactional replay consistency, cross-account reads and idempotency before v1 activation.

Current v0 frontend and WebGL stay untouched until v1 end-to-end capabilities match the preservation matrix. No new production table, migration, secret, binding or deployment in this contract batch. A schema or passing reducer test does not prove a deployed authoritative game or replay.
