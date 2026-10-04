# Ordered deterministic action validation

Server-only typed contract lives in `src/court-rules.ts`:
`CourtValidationStage`, `CourtValidationContext`, `CourtValidationHooks` and
`validateCourtAction`. No new HTTP fields or changes to public DTOs.

Every legacy/versioned court action already reaches `transition` / `reduceCourt`.
The reducer now runs schema → fact → role → evidence → procedure → policy checks
before cloning/mutating state. Existing teaching eligibility checks are reused;
no new legal claim or model-based legal decision is introduced. A missing case,
unsupported role, illegal action or invalid configuration cannot commit.
Evidence/ruling completion checks membership, not just equal array lengths.

Optional fact/role/policy hooks are synchronous trusted server functions. Only
literal true passes; rejection or exception aborts. Hooks run after the matching
built-in check and cannot override any rejection. Their frozen, detached context
contains only session/case/role/stage/version/action/evidence identifiers, not
owner credentials, user text, private graph or answer keys. Hooks must not perform
I/O, return promises or mutate external state. This is an in-process composition
contract, not a sandbox for untrusted code or arbitrary model responses.

Production calls currently use built-in checks only. Claude's semantic fact/role
integration remains absent: future adapters must validate any proposal against
server state and the shared contract; they cannot commit by returning true.
NPC utterance validation, creation and deletion use their separate current
validators and are not covered by this action pipeline. Do not claim the entire
goal section 4 is finished from this increment.

Compatibility: legal existing flows keep their actions and result shapes. Invalid
stored configuration or forged reviewed/ruling sets now reject instead of being
treated as completed investigation. No stored record is rewritten, no schema
migration, no data deletion. Rollback is previous code only and restores the old
weaker guards.

Tests: `node --test scripts/test-court.mjs scripts/test-court-validation.mjs`
passes seven groups: all six cases/all supported roles, ordered short-circuit,
veto/exception handling, state preservation, and forged/duplicate completion
lists. Full local `node scripts/ci-fast.mjs` passed (including TypeScript,
all fast suites, frontend contracts and unchanged Unity artifact checks).

## Release evidence — 2026-10-04

Source `305897715eeae4be35df735a4c16f0382981bee2`; GitHub CI `37169405143`
passed both fast checks and disposable workerd HTTP/RPC integration. Deployment
dry-run and `deploy --keep-vars --strict` passed. Worker version:
`acb2d090-7978-45b6-a2d4-22ec526c2bab`; upload 489.82 KiB / gzip 111.83 KiB,
startup 4 ms. No static assets, bindings, schema or secrets changed. Existing
uncommitted Ollama comments/whitespace were present; executable provider code
matches source. Rollback target: `39be10c6-e93c-475c-8004-313fcd6ac882`.

Post-deploy anonymous capabilities/cases returned 200; v2 session read returned
401 with apiVersion 2, HTTP_401, null data and matching X-Request-ID. These probes
confirm reachability/auth rejection, not authenticated production action flows.
No production user/session records or model calls were created for this check.
