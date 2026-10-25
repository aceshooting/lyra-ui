# Whole-project coverage evidence model

Qualification requires a single exact commit, complete actual runs, and public source evidence. A changed commit invalidates the numerical qualification until its source census and runs are checked again. This document describes a reporting method; it does not change any collection exclusions, coverage floors, or test gates.

The project uses native V8 coverage converted by locked `v8-to-istanbul` 9.3.0. Its statement map contains one counter per original physical source line after trimming trailing whitespace. This is a physical-source-line statement-counter model. It is neither JavaScript AST statement instrumentation nor a Codecov API line percentage. The converter's `_buildLines()` and `_statementsToIstanbul()` establish the counter model. Source maps must resolve generated bundles to their canonical original source files before aggregation.

The scope includes original runtime in all seven packages and original repository tooling, build/check/release scripts, example code, extensionless executable/shebang scripts, hooks, package-manifest script bodies, dependency-patch added lines and workflow `run` blocks. All patch additions are retained conservatively, including ambiguous generated or third-party-looking additions, unless separately proved out of scope. Tests, test fixtures, stories, declarations, third-party implementation, assets and generated duplicates are excluded explicitly. Original generators and original transforms remain in scope. A file is excluded as type-only only with compiler evidence; generated forwarding/registration copies require generator provenance. Every substantive exclusion is bound to a source SHA-256 so a source change forces renewed review. Files with ambiguous status remain fully uncovered.

For each unique canonical source path, complete same-commit measured counters supply its covered numerator while its full physical-source-line ceiling remains in the denominator. Any physical source line absent from a sparse map contributes zero coverage. Other own-source files contribute zero covered counters and `max(1, LF_count(source.trimEnd()) + 1)` total counters. Measured maps are deduplicated before aggregation. A raw map may contain test fixtures or other already-excluded sources: their counters are still validated, then recorded in `ignoredMeasuredSources` and omitted from both numerator and denominator. Unknown sources remain an error; raw maps are retained without dropping those entries. Reported statement locations must each span one physical source line and counter count must not exceed that file's ceiling. Sum covered counts and total counts; do not average package percentages. This produces a lower bound because missing measurement is treated as completely uncovered and its total uses an upper bound.

Shell, Python, inline workflow code and complete HTML/Vue/Svelte/MDX wrappers are conservatively included as physical source lines under the declared source-counter model. The V8 converter proof does not establish a language-independent AST statement bound. Any qualification must disclose this semantic limit. An assessor requiring literal AST statement instrumentation would need a different, consistent collector for the whole scope.

Evidence must include exact commit, complete run status, commands, package totals, uncovered inventory, exclusions and their proof, raw coverage-map archive digests, report metadata, public run links and source links. Uploaded browser JUnit alone is not a coverage report. UI collectors must be checked against the committed inventory because observed-source filtering does not automatically enroll unloaded modules. A complete docs report zero-enrolls its own unloaded runtime modules. Historical measurements can illustrate the method but cannot qualify a newer commit.

`scripts/report-statement-coverage.py` is a reporting candidate. Run it from repository root with exact commit, evidence manifest and content-addressed exclusions. It reads only committed source blobs. Evidence provenance is an explicit attestation input, not something the script can establish from an arbitrary JSON map. Independent verification of commit, complete selection, shard membership, archive hashes and successful actual runs remains required before public use.

## Current qualification status

The published 30.1.0 release has no new qualified whole-project statement report. Historical
evidence below retains its recorded source and scope. The final UI Codecov result and remaining
coverage work are tracked in [test health](roadmap/test-health.md); neither a UI-only report nor
passing release and focused tests establishes this document's whole-project evidence requirement.

## Reproduce

Use Python 3 with PyYAML installed, the pinned Node/dependencies, and complete coverage reports for the same commit. Existing package commands collect the UI and docs maps; merge UI shards with the project's coverage merge tool before using this report. Independently verify successful exits, complete test selection and artifact digests first.

Create `evidence.json` outside the checkout:

```json
{
  "commit": "FULL_COMMIT_SHA",
  "reports": [
    {
      "package": "packages/lyra-ui",
      "coverage": "ui-coverage-final.json",
      "complete": true,
      "provenance": "Public successful run URL and verified artifact SHA-256"
    },
    {
      "package": "packages/lyra-docs",
      "coverage": "docs-coverage-final.json",
      "complete": true,
      "provenance": "Exact-commit complete Node and Chromium run evidence"
    }
  ]
}
```

Each report path is relative to the invocation directory. Coverage source keys can be absolute paths or repository-relative canonical paths; output contains only repository-relative paths. The script rejects overlapping reports, so first merge browser/Node coverage of a shared module with the existing coverage tooling.

Create `exclusions.json` as an array of records with `path`, `sha256`, `reason`, and `proof`. An empty array is valid and conservatively counts all otherwise eligible source. Prepare these records from actual compiler emission or deterministic generator checks, rather than selecting exclusions to reach a percentage. Retain the commands and successful results with the evidence. The reporter verifies source hashes but does not execute the proof text. A changed excluded blob is rejected until its proof is refreshed.

```sh
python3 scripts/report-statement-coverage.py FULL_COMMIT_SHA evidence.json exclusions.json > statement-coverage.json
python3 scripts/report-statement-coverage.test.py
```

The report includes each file, measured/unmeasured status, covered numerator, denominator ceiling, package totals, exclusions and all workflow run blocks, package-manifest commands and patch-addition counts. Its `supports80WithinDeclaredModel` value compares the lower bound to 80%; it does not certify provenance or assessor acceptance of the declared model.

Counter-model sources: [`v8-to-istanbul` source-line construction](https://github.com/istanbuljs/v8-to-istanbul/blob/v9.3.0/lib/source.js), [statement-map construction](https://github.com/istanbuljs/v8-to-istanbul/blob/v9.3.0/lib/v8-to-istanbul.js). The repository lockfile and coverage adapter patch determine the installed converter and merge behavior.

## Original patch code and moved upstream blocks

Patch additions remain uncovered by default. A separate optional provenance proof can exclude exact upstream implementation that a patch relocates. It never excludes an entire patch or grants coverage to its original changes.

[`engine-patch-provenance.json`](evidence/engine-patch-provenance.json) records the DOCX engine source lock, upstream archive digest, patch digest and exact source/destination ranges. The proof uses a fixed minimum of twenty consecutive, byte-identical physical lines. Candidates must be actual deleted blocks from the pinned upstream input, not arbitrary similar text elsewhere in a dependency. No whitespace normalization or token matching is used. All unmatched additions, including short matching fragments, comments and type-only text, remain wholly uncovered. This rule is independent of coverage percentages.

The reproducible proof verifies the upstream archive length and SHA-256, every selected input's length/SHA-256/Git blob identity, exact patch application, and every prepared source's length/SHA-256. It also verifies that each deletion matched by the proof is present at the recorded position in the original upstream input. Its range records contain block digests and original, destination and patch-line locations. The checked-in proof identifies the source commit used to generate it; it applies to a later coverage commit only when its source-lock and patch blobs remain byte-identical. Coverage measurements themselves still require that later exact commit.

Reproduce from repository root using Python 3. Acquire the immutable upstream archive URL recorded in `packages/lyra-docs/scripts/engine-source.lock.json`, then run:

```sh
python3 scripts/prove-moved-patch-code.py FULL_COMMIT_SHA upstream.tar.gz patch-provenance.json
python3 scripts/report-statement-coverage.py FULL_COMMIT_SHA evidence.json exclusions.json --patch-provenance patch-provenance.json > statement-coverage.json
```

Keep the archive and generated report outside the checkout. The proof generator reads archive members in memory without extracting archive paths. The reporter validates content-addressed source and excluded patch ranges; independent verification or reproduction of the upstream proof remains necessary. Omitting `--patch-provenance` conservatively retains every patch addition.
