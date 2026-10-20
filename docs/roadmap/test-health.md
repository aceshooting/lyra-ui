# Test health: coverage, speed and flakiness

Status (2026-10-20): in progress; speed and coverage work is built but not yet merged. Baseline from the last green main commit before 30.0.0 work
(Codecov and GitHub Actions data).

## Baseline

- Coverage 99.74% of 504,496 lines (1,282 missed). The first 30.0.0 commit dropped the reported
  figure to 99.01% because one coverage shard failed and never uploaded; that regression is fixed
  first.
- CI wall-clock about 21 minutes. Critical path: coverage shards (8.9 to 11.3 minutes; shard 4 is
  the slowest), WebKit (9.6), lint (8.4), Firefox (8.4).
- About 34,700 Chromium tests take about 1,300 s in total. The time is spread out: the 20 slowest
  files are 19% of it, the 100 slowest 46%.
- Over 7 days Codecov recorded 34 failures among about 18 million test results, all on single
  commits and fixed since; no test fails repeatedly. Outside Codecov, the WebKit document-editor
  qualification step fails intermittently.

## Tasks

### Coverage (target: at least 99.80% of lines)

- [ ] Restore at least 99.72% after the 30.0.0 collections and map camera work (failed shard,
  uncovered new code). The failing shard came from two regressions of the collection rule:
  `lr-av-player` and `lr-notebook-viewer` (both fixed on main; complete coverage confirmation pending).
- [ ] Cover the most-missed modules with behavioural tests (no forged internals): `lr-map` (41
  lines), `lr-chart` (30), `lr-graph` (26), `internal/aria-controls` (23), `lr-data-grid` (21),
  `lr-push-to-talk` (16), `ssr` (16), `lr-flow-canvas` (15), `lr-message-actions` (13), menu, heatmap,
  virtual list, multi-split, graph spatial controller, knowledge-graph explorer, alert, chips.
- [ ] Remove code that is provably unreachable instead of testing around it; document any genuine
  exclusion.
- [ ] Raise the stored coverage floors to the new level.

### Speed (target: CI wall-clock under 15 minutes)

- [ ] Rebalance coverage shards by measured duration (shard 4 is 2.4 minutes slower than shard 1),
  or add a shard if the free-tier concurrency allows it.
- [ ] Speed up the slowest files without losing assertions: `lifecycle-contracts` (59 s),
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
