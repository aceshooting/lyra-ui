# Test health: coverage, speed and flakiness

An earlier 30.1.0 candidate report (2026-10-24), associated with
[the recorded CI run](https://github.com/aceshooting/lyra-ui/actions/runs/40132849858), contained
523,467 fully hit lines out of 526,890 (99.3503%; displayed as 99.35%), with 2,570 misses and 853
partials. The combined seven-package report had 542,398 fully hit lines out of 545,849 (99.3678%;
displayed as 99.36%). All five UI shard artifacts were merged and uploaded; that candidate CI run
still failed its SSR classification assertions and other qualification checks. These remain
historical candidate observations, not results for the published release commit.

The [published 30.1.0 release commit](https://github.com/aceshooting/lyra-ui/commit/1b275c39c066001ac29ccc7ab55fad452b5c9a07)
has a complete Codecov UI flag from [successful CI](https://github.com/aceshooting/lyra-ui/actions/runs/40169991813):
523,710 fully hit lines out of 527,148, with 2,579 misses and 859 partials. Codecov reports
99.34% for the flag, matching the deployed [coverage JSON](https://aceshooting.github.io/lyra-ui/badges/coverage-lyra-ui.json)
and rendered [CodeCov badge](https://img.shields.io/endpoint?url=https%3A%2F%2Faceshooting.github.io%2Flyra-ui%2Fbadges%2Fcoverage-lyra-ui.json).
The GitHub README places Coverage after CI and CodeQL. This is UI-flag coverage, not a whole-project
statement-coverage report. **The Codecov 99.80% goal remains open.**

The published 30.0.0 UI baseline was 520,554 of 525,881 lines (98.9870%). The 30.1.0 release
retains and improves on that complete UI-flag result. Each release must retain at least its
predecessor's complete UI flag result and aims to add about 0.1 percentage point; 99.74% and then
99.80% remain longer-term goals. The combined repository percentage cannot substitute for the UI result. README badges
publish the Codecov flag percentage through the docs site and may retain a previous figure when a
report is unavailable, so a badge alone is not exact-commit evidence. See
[coverage gates](../agents/ci-and-gates.md#release-integrity).

The earlier successful raw UI coverage run at `ed580b4d0` covered 524,831 of 525,881 lines
(99.800335%) across 1,502 ordinary test files. All five raw coverage shards and their merged gate
passed. This remains a valid historical raw line metric, not evidence of Codecov full-hit coverage
at 99.80%. The stored raw line and statement floors remain 99.75%; they are unchanged and separate
from the Codecov goal. New candidates need complete, exact-commit reports before claiming progress.
Sustained speed work continues; the historical successful 13m53s CI observation is recorded below.
The baseline below predates the 30.0.0 work.

## Baseline

- The earlier plan reported 99.74% coverage over 504,496 lines (1,282 missed), followed by a
  99.01% observation associated with a failed coverage-shard upload. The original metric and
  source for those figures are not reproduced here. That incomplete historical report does not
  explain the complete, branch-aware Codecov results. The earlier complete `b18754382` report
  had 520,655 fully hit UI lines out of 525,911 (99.00059135%), with 3,842 misses and 1,414
  partials; the newer exact-commit result is recorded above.
- CI wall-clock about 21 minutes. Critical path: coverage shards (8.9 to 11.3 minutes; shard 4 is
  the slowest), WebKit (9.6), lint (8.4), Firefox (8.4).
- About 34,700 Chromium tests take about 1,300 s in total. The time is spread out: the 20 slowest
  files are 19% of it, the 100 slowest 46%.
- Over 7 days Codecov recorded 34 failures among about 18 million test results, all on single
  commits and fixed since; no test fails repeatedly. Outside Codecov, the WebKit document-editor
  qualification step fails intermittently.

## Tasks

### Coverage (target: Codecov full-hit coverage of at least 99.80%)

- [ ] Reach 99.80% Codecov full-hit coverage with behavioural tests. At the complete `415b37039`
  report's fixed denominators, the UI needs 3,238 more fully hit lines and the repository 3,228;
  later source changes can change those denominators. Do not substitute a raw line report or a
  partial upload for this result.
- [x] Record the historical raw 99.80% observation: the complete `ed580b4d0` run covered 48 more
  lines than `f56acab97` at the same denominator, reaching 99.800335% raw line coverage.
- [x] Record the earlier plan's restoration observation after the collections and map camera
  work: 505,798 of 506,953 UI lines (99.7722%) in 1,415 ordinary test files plus the native-scrollbar
  check. The original metric is not reproduced here and does not establish the Codecov goal.
- [ ] Cover the most-missed modules with behavioural tests (no forged internals). Earlier
  baseline counts identified `lr-map` (41 lines), `lr-chart` (30), `lr-graph` (26),
  `internal/aria-controls` (23), `lr-data-grid` (21), `lr-push-to-talk` (16), `ssr` (16),
  `lr-flow-canvas` (15), `lr-message-actions` (13), menu, heatmap, virtual list, multi-split,
  graph spatial controller, knowledge-graph explorer, alert and chips. These counts describe the
  earlier planning baseline, not the current Codecov misses. Refresh the ranking from a complete
  exact-commit Codecov report before choosing the next cases, counting both misses and partials.
  Reviewed examples at `b18754382` include 356 non-full lines in the main map class, 94 in the
  graph class, 73 in theme handling and 39 in the shared table viewer; this is not a complete
  ranking.
- [ ] Remove code that is provably unreachable instead of testing around it; document any genuine
  exclusion.
- [x] Raise the stored raw line and statement coverage floors to 99.75%; keep them unchanged.

### Speed (target: CI wall-clock under 15 minutes)

- [x] Observe a [complete successful main CI run](https://github.com/aceshooting/lyra-ui/actions/runs/39750951606)
  under 15 minutes: 13m53s across 37 jobs. Its four coverage test steps took 10m06s, 8m11s,
  9m12s and 8m07s in shard order. Measured costs are refreshed; runner variation and the
  remaining duration spread still need tracking.

- [x] Refresh measured per-file costs and use median observations for browser shard balancing.
- [x] Reduce default condition polling from 50 ms to 10 ms while preserving explicit caller
  intervals and timeouts.
- [ ] Speed up previously profiled files without losing assertions. Earlier timings included
  `lifecycle-contracts` (59 s),
  `virtual-list` (42 s), `navigation-menu` (40 s for 152 tests), `map` (34 s), `package-entrypoints`
  (one test takes 14 s), `chart`, `lite-chart`, `thread-list`, `glass-contrast`, `pdf-viewer`,
  `context-menu`, `markdown-code-header`, `poll-status`, `generation-metrics`, `toast-item`.
  Typical causes to look for: fixed real-time waits that can become event or condition waits,
  repeated full mounts that can share a fixture, and scale fixtures larger than their assertion
  needs.
- [ ] Find the remaining WebKit and Firefox lane hot spots and apply the same treatment.

### Flakiness

- [x] Stabilize the WebKit document-editor qualification (`lyra-docs`): an image measurement
  intermittently runs before the image exists.
- [ ] Keep a weekly check of Codecov test analytics; any test that fails on two different commits
  gets fixed or quarantined with a tracked reason.

### Current 30.2 maintenance qualification

Status: unpublished; complete exact-commit qualification remains open. The 44-file affected UI
slice passes in Chromium, Firefox with WebGL, and WebKit, retaining its engine-specific skips.
Map preparation/runtime parity, provenance and packed three-engine checks pass; complete map
coverage records 100% lines and statements for the exercised candidate. Shared coverage helpers
retain 100% measured coverage without changing package-owned exclusions or floors. Complete UI
coverage records 99.85% lines/statements, 97.64% branches and 99.47% functions. These raw totals
do not establish Codecov full-hit coverage or a release pass.

- [x] Exercise the implemented corrections, hierarchy/chart/label helpers and map-anchor changes
  in the affected three-engine UI slice.
- [x] Review generated metadata for removed public APIs and experimental maturity wording:
  no removed API was found across 311 components; 28 profile changes retain experimental status.
- [x] Complete deterministic paired image-navigation comparison with matching archive/semantic
  hashes, targets and runtime identities. The single-drawing regression is recovered; retain the
  higher sampled allocation for large multi-drawing relationship sets.
- [x] Exercise 236 main editor cases per engine (708 total), plus three locked-source regressions
  per engine (nine total); source checks retain their narrower artifact scope.
- [x] Verify focused chip corrections: six cases per engine pass. Preserve the published metadata
  snapshot and verify all 33 metadata checks.
- [x] Integrate and review shared synchronous admission, all-format asynchronous service routing
  and UI adoption; verify the corrected model lifecycle and PLY mesh cases. Model checks pass
  686 unit tests and 106 packed browser cases per engine. UI adoption passes 82 cases in
  Chromium/WebKit and 76 with six retained skips in Firefox.
- [x] Complete model unit and packed browser acceptance: 686 unit checks plus lint and 106 packed
  cases in each of Chromium, Firefox and WebKit pass. Complete model coverage records all
  7,927 lines/statements hit (100%), functions 99.7% and branches 97.96%.
- [x] Complete the refreshed full coverage run after five meaningful critical-branch tests were
  added; all 686 unit checks pass and runtime behavior is unchanged. Retain the required changeset
  explanation for actual public synchronous GLB cost (about 44–49 ms versus roughly 12 ms
  baseline), under the advisory timing policy, and complete integrated release qualification.
- [x] Complete the final real-GPU interaction/control campaign: 48 runs, 24 pairs and 120
  exact-output stages pass independent review of hardware/source identity, worker completion and
  disposal. Retain residual dense CPU cost disclosure under the advisory timing policy.
- [x] Complete the UI coverage run: 99.85% lines/statements, 97.64% branches and 99.47% functions.
- [x] Complete trusted graph interruption checks: twelve cases preserve exact replacement/disposal
  behavior during initialization before the first completed iteration; mid-solver latency remains
  outside this measurement.
- [x] Complete three model cold-load pairs with exact pixels/positions and hardware/request
  boundaries. The initial artifact gzip estimate falls from 181,525 to 170,847 bytes; later format
  loads are slower.
- [x] Complete candidate lint/spelling, metadata, architecture, 311-component quality generation,
  UI bundle/package and companion budget checks with reviewed approved budget changes.
- [x] Complete the same-harness quick comparison: all 15 scenarios and functional/count assertions
  pass. Across 150 timing metrics, twelve regress and eight improve; this is advisory evidence,
  not a passed performance gate. Retain the required public changeset explanation.
- [ ] Complete final end-to-end setDataAsync performance qualification at 100k/1M inputs, covering
  worker and fallback routes, trusted input/cancellation, total rendering and retained memory.
  Existing asynchronous correctness cases do not complete this campaign. Historical native
  endpoint/post-disposal memory counters do not measure parser-only peak heap; RSS is process maximum.
- [ ] Stamp final package versions, regenerate version-derived artifacts and remeasure budgets;
  preserve behavioral and coverage policy.
- [ ] Complete final companion coverage/mutation/packed checks and the exact-release CI, Test All
  Browsers, full browser-engine and Quality tools runs, including the A/B benchmark.
- [ ] Record complete exact-commit UI Codecov totals against the published 30.1.0 baseline,
  retaining the distinction between full-hit coverage and raw line/statement floors.
- [ ] Verify protected publication, package integrity/provenance and website production delivery.

The dependency-upgrade prerequisite is complete. CodeQL and Scorecard pass, but the prior complete
CI result failed; focused repairs do not turn it into a release pass. Complete exact-source green
qualification remains required.

The [nineteen-item status table](30.2-maintenance.md#implementation-status) keeps source,
exercised checks and remaining delivery work separate. The 99.80% Codecov goal and historical
WebKit PDF investigation remain open; no maintenance extraction completes either.

### Current 30.1.0 qualification

A later regression in 30.1.0 affects asynchronous modular object-style replacement: active
ordering overrides can reject readiness, and the public layer catalog can retain the previous
style. Its correction now passes affected three-engine regressions but remains unreleased;
integrated qualification is tracked in the [30.2 maintenance plan](30.2-maintenance.md).

- [x] Verify the expanded chart/map/data and conversation/retrieval/internal coverage cases,
  including the chart-loading and progressive Markdown corrections. The integrated map and SSR slice
  passed 990 cases in each of Chromium, Firefox with WebGL, and WebKit.
- [x] Verify locale-picker popup lifecycle notifications: all 133 cases passed in each of Chromium,
  Firefox and WebKit, including request vetoes, forced close, superseded transitions, Escape ownership
  and disconnect/reconnect. This focused result does not qualify the complete release.
- [x] Verify declarative basemap ordering with the complete 106-file map/SSR suite: 1,940 cases passed
  in each of Chromium, headed Firefox with WebGL, and WebKit, with zero retries. This includes
  restoration after owned-layer recreation, bounded selector expansion, absent provider targets,
  style replacement and native failure handling. These focused cases supplement the full release
  qualification below.
- [x] Rebuild and regenerate measured quality, public references, editor metadata and packaged skills;
  verify Storybook documentation freshness for all 311 tags.
- [x] Apply the hosted update of seven reviewed public source-contract records; API documentation
  freshness, final delivery budgets and installed-consumer checks pass.
- [x] Qualify and publish the [versioned release source](https://github.com/aceshooting/lyra-ui/commit/1b275c39c066001ac29ccc7ab55fad452b5c9a07).
  [CI](https://github.com/aceshooting/lyra-ui/actions/runs/40169991813),
  [CodeQL](https://github.com/aceshooting/lyra-ui/actions/runs/40169991832),
  [Scorecard](https://github.com/aceshooting/lyra-ui/actions/runs/40169991805),
  [Test All Browsers](https://github.com/aceshooting/lyra-ui/actions/runs/40169997731),
  [Full browser-engine](https://github.com/aceshooting/lyra-ui/actions/runs/40169999078) and
  [Quality tools including the A/B benchmark](https://github.com/aceshooting/lyra-ui/actions/runs/40170000191)
  passed. The [Release workflow](https://github.com/aceshooting/lyra-ui/actions/runs/40171843074),
  [Docs deployment](https://github.com/aceshooting/lyra-ui/actions/runs/40171556606) and protected
  publication of lyra-ui, lyra-ide and lyra-translations 30.1.0 completed successfully; the npm
  tarballs and provenance were verified against the GitHub releases.
- [x] Verify the published release's deployed coverage JSON, rendered badge and GitHub README:
  the exact-commit Codecov UI value and live badge both show 99.34%, with the CodeCov label and logo;
  README badges are ordered CI, CodeQL, Coverage. The earlier 99.35% candidate report above is
  historical, not the published release value.
- [ ] Investigate and retain the unresolved status of the historical WebKit PDF hang. The observed failure
  included a 300-second test-file timeout and failed page shutdown. Repeated focused runs and two
  CI-shaped 160-file replicas, each containing 40 PDF executions, passed without reproducing it.
  Synthetic starvation can reproduce that timeout signature; this does not identify a PDF defect.
  No PDF fix has been established. If qualification reproduces the hang, collect passive per-case
  progress and fix the demonstrated cause before release; do not count a failed run as passing.
