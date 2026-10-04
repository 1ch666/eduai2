# Ordered deterministic action validation — candidate

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
weaker guards. This candidate has not been deployed.

Tests: `node --test scripts/test-court.mjs scripts/test-court-validation.mjs`
passes seven groups: all six cases/all supported roles, ordered short-circuit,
veto/exception handling, state preservation, and forged/duplicate completion
lists. Full local `node scripts/ci-fast.mjs` passed (including TypeScript,
all fast suites, frontend contracts and unchanged Unity artifact checks).
Remote CI and actual runtime release evidence must be added before release.
