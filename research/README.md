# Reproducibility infrastructure (not experiment results)

`version-registry.json` deliberately starts empty. Do not populate it with
invented model/dataset/prompt versions to make a demonstration look complete.
Claude's research work supplies actual values; Codex supplies the contracts and
validation. No external service, model call, research participant or new database
is involved in this directory.

Contracts:
- `contracts/version-registry-v1.schema.json`: immutable kind/version/digest
  entries for dataset, model, prompt, embedding, retrieval, reranker, benchmark.
- `contracts/experiment-run-v1.schema.json`: run UUID, actual UTC timestamp,
  full source commit, dirty state, optional seed, all seven versions, retrieval
  settings/config digest and result artifact digest. Null means unused/unknown
  seed; it is not a fabricated model version or evidence of determinism.
- `scripts/experiment-contract.mjs`: strict schema and relationship checks;
  rejects dirty source, duplicate versions, unknown references, impossible dates
  and inconsistent enabled/disabled pipeline metadata. Failure returns only a
  fixed code, not private contents.

For each future run:
1. Commit its code and nonsecret config; obtain the actual 40-character commit
   and verify the worktree is clean. Never use a made-up SHA or only `main`.
2. Register actual version IDs and SHA256 digests. A model entry identifies a
   retained model manifest (provider, immutable model revision where available),
   not an assertion that a mutable hosted model's weights are downloadable.
   Do not change the content behind an existing kind/version; add a new version.
3. Execute the actual approved evaluation. Retain input/config/result artifacts
   with SHA256 values, applicable licensing and privacy controls. Never commit
   private transcripts, user identifiers, credentials, or raw production data.
4. Construct metadata from that run, not a template presented as measured data.
   Use `validateExperiment(metadata, registry)` before accepting its record.
5. Independently verify the commit and artifacts/digests actually exist, and
   compare a rerun. Schema validation alone cannot establish provenance,
   artifact availability, model pinning, identical output or research quality.

Current evidence: schema/relationship unit tests use explicitly synthetic
fixtures only. They run in existing fast CI via `test-experiment-contract.mjs`.
No real benchmark run, persistent run registry, artifact archival/restore,
automatic runtime version stamping, immutable-registry update enforcement or
model reproducibility experiment has been completed. Those remain work under
the original goal; this is the stable handoff format, not final research proof.
