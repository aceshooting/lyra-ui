# Test health: coverage, speed and flakiness

Coverage is the Codecov UI flag, not a whole-project statement-coverage report. Each release must
retain at least its predecessor's complete UI flag result and aims to add about 0.1 percentage point;
99.74% and then 99.80% remain longer-term goals. The combined repository percentage cannot substitute
for the UI result. README badges publish the Codecov flag percentage through the docs site and may
retain a previous figure when a report is unavailable, so a badge alone is not exact-commit evidence.
See [coverage gates](../agents/ci-and-gates.md#release-integrity). The stored raw line and statement
floors remain 99.75%; they are unchanged and separate from the Codecov goal. New candidates need
complete, exact-commit reports before claiming progress. The published UI flag is about 99.3%;
earlier baselines and the 30.1.0 and 30.2.0 qualification records are
[archived](../archive/roadmap/test-health.md).

## Tasks

### Coverage (target: Codecov full-hit coverage of at least 99.80%)

- [ ] Reach 99.80% Codecov full-hit coverage with behavioural tests. At the complete `415b37039`
  report's fixed denominators, the UI needs 3,238 more fully hit lines and the repository 3,228;
  later source changes can change those denominators. Do not substitute a raw line report or a
  partial upload for this result.
- [ ] Cover the most-missed modules with behavioural tests (no forged internals). Refresh the
  ranking from a complete exact-commit Codecov report before choosing the next cases, counting both
  misses and partials.
- [ ] Remove code that is provably unreachable instead of testing around it; document any genuine
  exclusion.
- [x] Raise the stored raw line and statement coverage floors to 99.75%; keep them unchanged.

### Speed (target: CI wall-clock under 15 minutes)

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

- [ ] Keep a weekly check of Codecov test analytics; any test that fails on two different commits
  gets fixed or quarantined with a tracked reason.
- [ ] Investigate and retain the unresolved status of the historical WebKit PDF hang. The observed failure
  included a 300-second test-file timeout and failed page shutdown. Repeated focused runs and two
  CI-shaped 160-file replicas, each containing 40 PDF executions, passed without reproducing it.
  Synthetic starvation can reproduce that timeout signature; this does not identify a PDF defect.
  No PDF fix has been established. If qualification reproduces the hang, collect passive per-case
  progress and fix the demonstrated cause before release; do not count a failed run as passing.
