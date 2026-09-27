# Narrative draft validation boundary

`src/court-draft.ts` now owns the pure `parseCourtNarrativeDraft(unknown)` parser.
It returns a detached typed value or null without clocks, random IDs, shuffling,
network calls, storage, or changes to its input. Existing `validateGenerated`
in `src/court-generation.ts` calls this parser before building the randomized
teaching case. Existing valid JSON and public case outputs remain compatible.

Accepted fields remain exactly title, summary, facts, evidence; each evidence
has only title and text. Existing text/count limits and content filter remain.
The parser rejects absent/extra fields, non-plain records, inherited fields,
accessors, sparse arrays and invalid nested values. It returns new arrays and
records, preventing later input mutation from altering accepted content.
An in-process sparse facts array previously passed Array.every because holes
were skipped. JSON holes become null and were already rejected on the network;
this is boundary hardening, not a claim of an exploited production vulnerability.

The model cannot supply IDs, procedure, legal source IDs, role constraints,
answer keys or stage fields through this draft contract. Evidence IDs continue
to be assigned by the server, uniquely by index; legal settings are inherited
from the selected server template. Random creation remains outside the pure
parser. Existing stored cases are not revalidated, rewritten or deleted.

Tests: `node --test scripts/test-court-draft.mjs scripts/test-generation.mjs`
(7 passing), and TypeScript noEmit passed locally on 2026-09-28. CI discovers
the new test automatically. Tests use synthetic fixtures and mocked generation,
not paid/live inference. No new binding, service or migration is required.

Scope not yet complete: this narrative-only contract has no structured timeline,
fact IDs or witness-reference graph. Parsing text does not prove chronology,
factual consistency, legal accuracy, absence of prompt injection or stage/terminal
reachability. A versioned structured-case contract and deterministic graph checks
are still required by the backend objective; semantic research belongs to Claude.
Arbitrary hostile JavaScript Proxies are not a supported input boundary; production
input is bounded parsed JSON. Existing legal config validation remains separate.

Rollback: revert the parser integration and source file together; no data rollback
or migration is needed. This change does not require a Unity or game Docker build.
