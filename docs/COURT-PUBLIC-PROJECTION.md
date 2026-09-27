# Legacy court projection allowlist

Before adding server-only case graphs, the existing v0 `courtView` used rest/spread
after removing owner/generatedCase. A new top-level private field would therefore
become a public API field without deliberate review. Nested config/evidence extras
were also returned. This is a forward-compatibility data-boundary flaw, not evidence
that real private graphs already existed or had leaked in production.

`src/court-rules.ts` now enumerates public state/config fields and projects evidence
to id/title/text. Optional rulings and generationVersion retain their previous
presence semantics. Existing documented fields and valid JSON values are preserved;
new internal fields are denied by default. Arrays exposed from state are copied.
Public current-template facts remain public; this does not invent role filtering
or classify future private narrative text as safe.

Regression evidence: a test persisted synthetic private canaries at top-level,
config, template and evidence metadata in real in-memory SQLite. It failed before
the fix and passes afterward, checking CourtRoom.get, snapshotV1 and stored journal
output. The private server record remains intact; hiding fields does not erase data.
Cross-owner get still returns 404. Node mocks DO lifecycle, not a real workerd run.

34 journal/court/generation tests and TypeScript passed locally on 2026-09-28.
The normal CI also exercises real local workerd APIs. No migration, saved-case
rewrite, new permissions, model request, Unity or frontend change is required.

Case graph persistence is still not integrated. This projection fix is a necessary
boundary prerequisite, not completion of structured-case validation. Historical
events are not rewritten; no existing private-data incident is asserted. Future
private graph fields must stay server-only and receive dedicated integration tests
before enabling ingestion. Reverting this fix after private fields are stored
would reintroduce exposure: do not roll back to a spread-based projection then.

Release source: `1fd7013fb8d05c99e7933366917a283f6df69561`; fast and local API CI
passed at https://github.com/1ch666/eduai2/actions/runs/36340194262 . Dry-run and
existing Worker deployment succeeded, version `4d206cf3-a3c5-49b5-8efd-a1e38db88d42`.
No asset changes or data migrations. Prior version:
`06bcf6ac-af81-432e-9336-9867c97537ad` (subject to rollback warning above).
