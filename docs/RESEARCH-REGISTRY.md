# Research version registry

`research/version-registry.json` is a Git-versioned registry; its current empty
entries are intentional. Actual research values belong to the research owner.
Do not populate it with the synthetic versions used by tests or claim experiments
have run merely because this infrastructure passes CI.

Contract: `contracts/version-registry-v1.schema.json`. Each `(kind, version)` maps
to exactly one SHA-256 content fingerprint. Once published, that mapping must not
be removed or replaced. Reordering is allowed. Corrections use a new version.
The existing `experiment-run-v1` contract references these immutable identities;
schema-valid metadata alone does not prove a benchmark ran or its results are true.

## Gates and compatibility

`validateRegistryTransition(previous, next)` validates both registries, rejects
duplicates, removed identities and changed fingerprints, and accepts additions.
No schema migration is needed: v1 entries retain their exact existing shape.

`node scripts/check-registry-history.mjs` compares the working registry to HEAD
by default. Set `REGISTRY_BASE` to an exact trusted 40-character commit SHA to
compare against a different published baseline. No registry or Git history writes.

The fast GitHub workflow sets the baseline to PR base SHA or push `before` SHA;
thus a multi-commit push cannot hide an earlier replacement behind its last commit.
Manual workflow dispatch compares against its own selected commit (schema/baseline
sanity only, not a full historical audit). The optional `--fetch-base` retrieves
only that exact commit with depth 1 from origin. Git is invoked with argument arrays,
not shell interpolation. Invalid/missing baselines, registry files or fetch errors
fail closed; they never silently substitute an empty registry. A first-ever branch
push with zero `before` SHA needs an explicitly reviewed valid baseline.

This is a CI check, not branch protection or a tamper-proof registry: a maintainer
can edit the checker/workflow. No permissions or branch rules were changed. Keep
review of registry and gate changes separate from claims of immutable storage.
Do not roll back the registry to delete newer published versions when rolling back
application code; retain the additive registry or use a compatible release.

## Tests and outstanding work

`node --test scripts/test-experiment-contract.mjs` covers all seven registry kinds,
additions/reordering, replacement/deletion/duplicates, malformed baseline inputs,
missing Git objects and a real disposable Git repository with a multi-commit change.
The repository is synthetic, local and removed after the test; no live data used.

Content file hashing, artifact custody, verification that referenced source commits
and artifacts exist, experiment-run persistence/export/restore, and actual research
registrations remain unfinished. No inference, new paid service, Worker endpoint,
production data access or UI/Unity changes are part of this increment.

CI context reference: https://docs.github.com/en/actions/reference/workflows-and-actions/contexts
