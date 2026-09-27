# Court client integration — actual status

## Existing runtime

The deployed game still uses court/court.js and the existing NPC/panel bridge with v0 /api/court endpoints. Do not replace it before the preservation matrix passes. Unity does not receive browser credentials. This document does not claim the new v1 API is deployed.

## Implemented v1 components (not enabled)

- court/protocol.js and Networking/CourtWire.cs: bounded exact public projection parsing.
- court/client-state.js and Core/CourtClientState.cs: versioned isolated state; reject stale/conflicting/cross-session replies.
- court/transport.js: shell-only authenticated HTTP, one pending mutation, request correlation, body size/UTF-8/deadline handling, cancel on logout, explicit retries with unchanged serialized bytes and identifiers (at most 3). No automatic retry or AI/provider request.
- On uncertain mutation outcome (timeout, malformed reply, network or 5xx), keep current snapshot and block new actions. Refreshing a snapshot alone does not prove that the action failed and does not clear the pending request. recoverPending reads its recorded outcome without another POST. Missing outcome remains unknown.
- On 401, clear state and pending work; on 409, require snapshot refresh before new action. 429 honors bounded numeric Retry-After (up to 120 seconds); no paid upgrade or automatic purchases.

## Server contract implemented in source, not deployed

The following endpoints now exist. Runtime Unity activation remains gated on the bridge/presenter and preservation tests:

1. GET /api/court/v1/sessions/{sessionId}?requestId={uuid}: validated v1 snapshot echoing requestId.
2. POST /api/court/v1/sessions/{sessionId}/actions: v1 mutation; return committed event. Transactionally validate owner, expectedStateVersion, action legality and idempotency. Repeat identical request returns the same event without a new mutation or provider call; same ID with changed payload must be rejected.
3. GET /api/court/v1/sessions/{sessionId}/requests/{requestId}: owner-only original event for that request, or 404 while outcome absent/unknown. Never fabricate an event from current state. Final rejection outcomes need a separately versioned result schema before they can resolve an indeterminate request.

Cookies and CSRF only in shell transport; never forward them into Unity or logs. Origin must be the shell's own location.origin. No arbitrary URL comes from a Unity message. Exact parent/iframe source, origin, bridge generation and request matching still need to be implemented before binding this transport to SendMessage.

## Remaining integration and evidence

No game scene, Unity adapter or presenter uses this transport yet. The journal adds court_events and court_v1_requests to each existing CourtRoom, retaining old tables and endpoints. No formal Wrangler migration, binding, secret or production deployment has been performed. Local workerd HTTP tests now verify these v1 routes with real disposable local accounts and DO storage (see scripts/check-court-v1-api.mjs); this is not browser/WebGL or production evidence.

Pending work is memory-only. Reload recovery still requires a safe server-backed unresolved-request discovery design; do not persist auth tokens or private dialogue in localStorage. Do not claim the disconnect/reload acceptance scenario is complete.

Next: strict browser bridge and Unity adapter, complete projections (NPC/seat mapping and role-visible evidence), then replay, presenters and full flows. Current v1 actions reuse existing server rules; they do not implement new legal objections or witness-examination procedures. Keep v0 until replacement covers all existing functionality.

2026-09-27 verification: 26 Node tests passed, including actual SQLite state/event/outcome rollback and a lost-response recovery using CourtTransport against CourtRoom methods. Local workerd HTTP passed owner/auth/CSRF, unknown/duplicate fields, expected version, idempotent response and event count. It revealed and fixed RPC serialization incompatibility with the strict parser's null-prototype record; the HTTP boundary now copies validated primitive fields into a plain object. No secrets or private conversation were logged by the tests.
