# Optional court education assessment API

Status: implemented locally, default OFF; not deployed or a validated study.
The instrument is `court-reasoning-draft-1`, an original teaching draft, not a
validated scale. Formal user experiments have not been performed.

## Route and protection

`/api/v2/court/sessions/{sessionId}/education`

- GET: return the owner's current assessment view (not the whole instrument).
- POST: apply one assessment command below.
- DELETE: withdraw and erase assessment scores, survey and receipts; no body.
- OPTIONS: existing trusted-origin preflight; all other methods return 405.

All operations require the existing authenticated cookie. POST/DELETE also
require an allowed Origin and matching `X-CSRF-Token`. No owner ID is accepted
from the browser. The same CourtRoom checks the stored session owner. Requests
share the existing per-learner `court` limit (40); GET is also bounded. Session
IDs must be lowercase UUID v4. Responses use the existing v2 no-store envelope;
`stateVersion` is null because assessment revision is not court state version.
See `contracts/court-education-response.schema.json` for successful data shapes.

Collection requires `COURT_EDUCATION_ENABLED` exactly `true`, plus explicit user
consent before any court action. The flag is not set in repository deployment
configuration. Supported sessions are the authored tablet investigation, not
generated or observer sessions. Other cases return 409. With collection off,
GET/POST on a never-enrolled room returns data `{code:"DISABLED"}` without
creating tables. Existing records remain readable/withdrawable when disabled.

## Commands and recovery

POST requires `Content-Type: application/json`, valid UTF-8, at most 4096 bytes.
Top-level keys are exactly `requestId`, `expectedRevision`, `action`:

```json
{"requestId":"00000000-0000-4000-8000-000000000001","expectedRevision":0,"action":{"kind":"consent"}}
```

Generate a fresh lowercase UUID v4 for each new command; after an ambiguous
response retry the SAME ID/body or GET the current view. Never invent success.
IDs cannot be reused with changed content. Repeated keys, unknown fields,
invalid Unicode and unsupported action payloads are rejected.

The browser retains the exact pending command after an ambiguous transport
failure. A received POST 409 instead discards the refused command and clears
the cached view: a fresh GET is required before any new submission. It does not
automatically replay an illegal phase transition or claim that it succeeded.

Sequence (independent revision 0 through 5):

1. `consent`, revision 0: only when the court has not started.
2. `pre`, revision 1: submission `{version,phase:"pre",answers:{...}}` where
   keys are exactly the three question IDs returned by GET and values are
   zero-based option indexes (0–2). Only before court actions.
3. `case_completed`, revision 2: requests advancement, but the server reads
   actual court completion; this command CANNOT complete the court itself.
4. `post`, revision 3: same submission shape with phase `post` and its question
   IDs; server independently requires a completed court.
5. `survey`, revision 4: submission `{version,ratings:{clarity,evidence,followup,
   usability}}`, each rating an integer 1–5. No free-text fields.

Use the version returned by GET. Responses contain ACCEPTED/DUPLICATE,
appliedRevision and current view. GET contains view only. A duplicate response
may include a later view than its appliedRevision. Views reveal only the current
form; pre/post scores are shown only after post-test submission. No answer keys,
raw submitted answers, survey ratings or private court knowledge are returned.

HTTP 400 = invalid command/encoding/ID/body; 401 = login required; 403 = write
origin/CSRF rejected; 404 = absent/deleted/non-owned court; 409 = unsupported
case or conflicting revision/progress/ID; 410 = POST after withdrawal/expiry;
413 = oversized; 415 = wrong content type; 429 = limit; 500 = uncertain error.
Error envelopes contain no partial assessment data. DELETE is idempotent,
returns WITHDRAWN and cannot be undone for that session.

## Privacy, lifecycle and remaining acceptance

Scores/survey are held in an owned court session: this storage is NOT an
anonymous research export. Raw answers are not retained; canonical command
digests used for retry checking are NOT a guarantee of anonymization. The
30-day deadline starts at consent and does not extend on reads or retries.
Withdrawal, expiry and court deletion erase assessment content and receipts,
retaining a minimal guard against re-enrollment/resurrection. CourtRoom owns
the retention alarm. No extra DO namespace, secret or migration is added.

Before enabling collection: implement/review the consent and withdrawal UI,
state exactly what is retained, verify actual workerd alarm delivery, validate
the whole authenticated browser flow and complete the research/privacy review.
Do not bypass the default-off gate to claim the research phase is complete.
Automatic anonymous learning-event integration, time metrics and formal human
testing remain separate unfinished work. Test fixtures are synthetic, never
participant results or evidence of educational effectiveness.

## Rendered browser check — 2026-10-04

On isolated localhost port 8798 with synthetic credentials and AI disabled,
the actual browser verified the fixed case's optional assessment entry, default
unchecked consent, native validation rejecting unchecked consent, three empty
pre-test answer groups, saving a synthetic pre-test, and recovering that saved
state after reload. An early post-test request was rejected without changing
court version 0; refreshing then restored the usable playing-phase panel.

This caught native fetch's incompatible receiver when invoked as a client
instance method (Node's implementation had allowed it). The client now calls
the supplied fetch function without binding the client object. A receiver
regression and definitive-conflict recovery test were added; all 13 focused
client/host/panel tests pass. Screenshot is a local artifact under
`outputs/education-browser-20261004.jpg`, not committed research data.

This is partial browser acceptance, not a completed browser/Unity case or a
human study. Browser post-test/survey/withdrawal, mobile devices, alarm delivery,
privacy review and production deployment are still unverified.

## Continuous regression coverage

The existing `Fast regression checks` workflow now runs
`scripts/check-education-api.mjs` in a separate local workerd instance on port
8799 with an isolated runner-temporary storage directory. Assessment collection
is enabled only for that synthetic test instance; NPC AI is disabled and no
production or AI credentials are supplied. The step checks pre-test, the real
deterministic court-action sequence, post-test, survey, repeated requests,
ownership/CSRF rejection, result isolation, withdrawal and synthetic cleanup.
Its exit status gates the existing local-api job. It adds no deployment step,
new backend architecture or production collection setting. This API gate is
not a replacement for browser, Unity, device, alarm-delivery or human tests.
