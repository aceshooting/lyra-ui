# CI, lint gates, and release plumbing — lyra-ui agent reference

> Detail behind the "Dev commands and gates" section of [AGENTS.md](../../AGENTS.md). The digest
> there is the contract; this file carries the full gate lists, ordering rationale, and incidents.

## `contract-policy` (most of `pnpm lint`'s time)

`pnpm lint` recurses through the workspace. For `@aceshooting/lyra-ui`, its exact expansion is
`pnpm run contract-policy && tsc --noEmit -p tsconfig.json && pnpm run test:types && pnpm run
check:test-types`.

The authoritative ordered `contract-policy` chain is
`packages/lyra-ui/package.json#scripts.contract-policy`; do not maintain a second command list in
prose. It covers script/package metadata, source/style/part/provenance policies, component and
migration coverage, manifest/framework/LLM freshness, component inventory and metadata,
autoloader/registration/side-effect architecture, form/event/cycle/interaction/token/numeric/
translation contracts, and every associated tooling self-test. When adding, removing, or moving a
gate, edit that package script first; local `pnpm lint` and the CI lint sharder both derive their
inventory from it automatically.

**Toolchain constraint: `typescript@7` is the native Go port and exposes no JS compiler API.**
`ts.version` works, but `ts.SyntaxKind` and `ts.createProgram` are `undefined` — any tool that
imports `typescript` and drives the compiler API crashes on load (confirmed for `type-coverage`;
the same failure is certain for `typescript-eslint` type-aware rules, `ts-morph` codemods, and
`@stryker-mutator/typescript-checker`). When proposing a new lint/coverage tool here, reach for
TS-API-free options instead: `tsc`'s own strict flags, bespoke `check-*.mjs` AST-free scanners,
`secretlint`, `knip`, `cspell`. `tsc --noEmit` itself is unaffected — that's the native compiler
doing its own job, not a caller walking its AST.

`check:component-dependencies` (`scripts/check-component-dependencies.mjs`, with a colocated
`check-component-dependencies.test.mjs` chained beside it) covers a failure mode that is otherwise
hard to see. It parses every `<lr-*>` start tag out of each component's `html` /
`staticHtml` / `svg` templates — plus the `unsafeStatic(tag('x'))` indirection — and proves each one
resolves to a registration reachable from that component's own registration entry's transitive
imports (static, `export ... from`, and lazy `import()` alike, so `lr-phone-input`'s deliberate lazy
`<lr-flag>` registration is not a finding). It exists because the class/registration split that
makes this package tree-shakeable also makes the bug silent: `tool-result-view.class.ts` imported
the side-effect-free `copy-button.class.js` and rendered `<lr-copy-button>`, while
`tool-result-view.ts` never imported `copy-button.js`. Nothing ever called
`defineElement('copy-button', …)`, so a consumer taking the granular import path this package
recommends got an inert, never-upgrading element — no error, no warning, an empty inline box. Any
aggregate entry that pulls in every registration module (the all-registrations barrel, and the
Storybook/test setups built on it) hides the defect completely, which is why it survived a colocated
test that imports only its own `./<name>.js` and asserts on `[part]` attributes. The fix is always an
`import '<dep>/<dep>.js'` line in the _registration entry_, never a registration side effect pulled
into a class module. The rare genuinely cycle-bound pair is suppressed in the registration entry
with `policy-allow(component-dependency: lr-menu): <reason>`; the reason is mandatory and a
suppression that no longer silences anything is itself reported, so the list cannot rot.

`check:composed-child-contracts` (`scripts/check-composed-child-contracts.mjs`, with its own
colocated self-test) covers the other silent half of composition: a registered child can still
ignore a misspelled/removed attribute or an expando property that is absent from its public API.
The checker parses component and Storybook Lit templates with `oxc-parser`, validates static
attributes plus `.property`/`?attribute` bindings against `custom-elements.json`, follows CEM
superclass/mixin declarations, and consumes the manifest configuration's exported effective
`DocumentAnchorTarget` surface for direct and indirect source-only mixin adopters. It fails closed
if it scans zero templates, tags, or bindings. Its
self-test uses isolated temporary packages with positive, negative, inherited-member, recursive-
self, Storybook, and zero-accounting fixtures; it never rewrites the workspace manifest.

Two gates deliberately sit **outside** `contract-policy`, because both read artifacts that a static
lint run does not produce:

- `check:build-artifacts` is chained into `build` itself —
  `"build": "node scripts/build.mjs && pnpm run check:build-artifacts"` — so it runs at the only
  point where `dist/` is guaranteed present and current, which also covers `prepack` and therefore
  every published tarball. `scripts/check-build-artifacts.mjs` fails on any `.map` file in `dist`
  and on any emitted file carrying a `sourceMappingURL` comment; the same script entry then runs
  `scripts/ai-compile-contract.test.mjs`, proving compile-only AI assertions have no source,
  emitted module, package subpath, or tarball entry. See "`tsconfig.build.json` and dist hygiene"
  below.
- `check:coverage-floors` (`scripts/write-coverage-floors.mjs`) reads a finished coverage report;
  see "Coverage floors" below.

## CI: `.github/workflows/ci.yml` is authoritative

**`ci.yml` is the authoritative gate list and reproduction sequence.** Read it directly rather
than trusting a restated list, and reproduce a CI failure locally with the same commands in the
same order. The old single `build-test` job was one linear sequence; it's now six primary jobs split
along real data dependencies (verified against the actual scripts, not assumed) so independent
gates run in parallel instead of queueing behind each other. If a check goes red, the job name in
the PR checks list tells you which of these to reproduce locally:

1. **`lint`** — three `lint_shard` workers independently install, then run a deterministic weighted
   partition of the package's `contract-policy` commands plus `tsc --noEmit -p tsconfig.json`,
   `test:types`, and `check:test-types`. The runner reads those commands directly from
   `package.json`; there is no second
   gate list to drift. Occurrence ordinals make the split disjoint and exhaustive even if a command
   is deliberately repeated, source-controlled observations weight the expensive checks, and a new
   valid command receives unit cost rather than disappearing. Every worker restores original policy
   order within its own lane and uses a full-history checkout because the component-metadata gate may
   move when the inventory changes. A stable `lint` aggregate runs with `always()` and fails unless
   the entire matrix concluded `success`.

   The reference run's sequential `pnpm lint` step took 8m22s. Its three estimated lane weights are
   170/170/170, bounded by the 163-unit component-inventory test, so a fourth worker would add setup
   and concurrency pressure without shortening the critical path. Local `pnpm lint`, `scripts/ci.sh`,
   and release generation remain complete and sequential; the shard entry is CI-only. No lint lane
   needs Playwright or a build because every command is static analysis.
2. **`static-checks`** — everything needing neither a library build nor a docs build. Its inputs are
   already-committed files except for one read-only, content-addressed npm fetch. It validates
   workflow syntax and the generated release-qualification manifest; runs the release-integrity,
   public-API, pinned-upstream, other-workspace-package, dead-code, and secret checks; then
   regenerates and diffs registrations, the custom-elements manifest, editor data, README status,
   plugin references, skill archives, and Storybook theme contracts. The exact commands and their
   order live only in `.github/workflows/ci.yml`; copy the failing job's steps from there when
   reproducing it.

   `pnpm readme:check` covers two intentionally different files: root `README.md` (monorepo
   overview) and `packages/lyra-ui/README.md` (what npm actually renders on the registry page).
   Keep both READMEs' badge rows in sync by hand; don't add a second hand-maintained "N
   components" figure alongside the tag count — only a single count derived from
   `custom-elements.json` (e.g. "N custom elements") is self-verifying, a separately hand-bumped
   "components" number silently drifts every release.

3. **`build-and-coverage`** — a dependency graph shares one build and fans the browser-heavy
   coverage path across four hosted runners before a final stable aggregator:

   - `build_and_coverage_build` (`pnpm build`) uploads `packages/lyra-ui/dist/` as artifact.
   - `build_and_coverage_quality` (`pnpm --filter @aceshooting/lyra-ui check:component-quality:built`,
     `pnpm --filter @aceshooting/lyra-ui check:bundle-size`, `pnpm --filter
@aceshooting/lyra-ui codecov:bundle`) consumes the shared dist.
   - `build_and_coverage_ssr` (`pnpm --filter @aceshooting/lyra-ui test:ssr`) consumes the shared
     dist.
   - `build_and_coverage_hydration` (`pnpm --filter @aceshooting/lyra-ui test:hydration`) consumes
     the shared dist.
   - `build_and_coverage_coverage_shard` is a four-leg matrix. Every worker consumes the shared
     dist, runs `node scripts/coverage-shard-runner.mjs --shard N` in the pinned Playwright image,
     and uploads exactly one non-hidden `coverage/shards/coverage-shard-N` artifact. Artifact
     upload runs even after a red browser result for diagnostics, but `if-no-files-found: error`
     prevents an absent report from passing.
   - `build_and_coverage_coverage` runs with `always()` after the matrix. It downloads all four
     artifacts to their exact expected directories, invokes `--merge`, enforces
     `check:coverage-floors` against the merged whole-suite report, and performs the non-fatal
     Codecov coverage/JUnit uploads. The runner refuses a missing `coverage-final.json`,
     `junit.xml`, or `test-files.json`, and proves the four test manifests are disjoint,
     exhaustive, and the deterministic partition of the current inventory. The job separately
     rejects any non-success matrix result, so mergeable reports from a failed test cannot mask
     that failure.

   Each coverage worker still runs one browser file at a time for determinism; only independent
   workers run concurrently. The prior coverage step took 14m05s in the reference run, while its
   four sequential browser shards took 2m52s, 3m56s, 3m22s, and 3m49s. Hosting those same shards
   independently moves the expected `build-and-coverage` critical path from about 17 minutes to
   roughly 7–8 minutes after fixed checkout/install/artifact overhead, making the roughly
   nine-minute lint job the likely long pole. Four is the useful split: finer shards would add
   another full runner bootstrap per slice and compete with the workflow's other matrices for the
   public-runner concurrency cap.

   The ordinary local `pnpm --filter @aceshooting/lyra-ui test:coverage` remains complete and
   sequential: it runs all four shards, merges, enforces the same floors when followed by
   `check:coverage-floors`, and cleans its shard scratch tree. `scripts/ci.sh` and `scripts/test.sh`
   continue to call that default rather than the CI-only `--shard`/`--merge` modes. This is the one
   time lyra-ui's own Chromium suite runs in push CI; a separate `pnpm test` would repeat the same
   files without coverage. `build_and_coverage_build`'s `pnpm build` step still runs
   `check:build-artifacts`, which is chained inside the package's `build` script. Browser-dependent
   lanes use the Playwright image pinned in the workflow, so they do not install browser binaries
   or OS packages on each run.

4. **`packed-consumer`** — a stable aggregate over three independent phases. The contract lane
   needs `dist/` (the tarball's `files` list includes it) but nothing else `build-and-coverage`
   needs, so it gets its own `pnpm build` rather than waiting on that job. It verifies the tarball's
   required files, then runs the complete packed install/import/declaration/bundle/framework
   contract and packed-size budget. Only ATTW is skipped in this lane. ATTW's 935 non-CSS package
   exports are sorted and round-robin partitioned across four independent runners (234/234/234/233),
   cutting the measured ~15-minute monolithic type-resolution path to roughly four minutes without
   increasing ATTW process concurrency. Each shard runs `pnpm pack`, so it analyzes exact
   publishable bytes rather than the source directory. In parallel, the public-API lane consumes
   the shared dist artifact from `build_and_coverage_build` and runs the networked public-API
   semver gate. The aggregate requires the contract lane, all four ATTW shards, and the public-API
   lane. The ordinary local `pnpm check:packed-consumer` remains complete and unsharded; the
   CI-specific `pnpm check:packed-consumer:contracts` is the only path that skips ATTW.

   `packages/lyra-ui/tsconfig.json` sets `"stripInternal": true` — a declaration whose JSDoc
   carries `@internal` is erased from the emitted `.d.ts` even if a _public_ property's type
   alias points at it (e.g. a type living in `src/internal/` but referenced by a public
   `@property`). `pnpm lint`/`build`/`test`/`manifest` all compile the source tree directly and
   stay green regardless; only this job compiles a real consumer against the packed tarball and
   surfaces `TS2305: has no exported member`. The tag also matches anywhere in the JSDoc block,
   including prose — a comment describing "deliberately not tagged internal" re-triggers the
   strip.

5. **`docs-and-storybook`** — `docs_build` (`docs:build` only needs the already-committed
   `custom-elements.json` via its internal `manifest:check`, not `dist/`, so it's independent of
   the two build jobs above) runs `pnpm docs:build` once (with `CODECOV_TOKEN`), verifies the
   generated sitemap is fresh, and uploads `storybook-static/` as an artifact, the same
   "build once, fan out" shape
   `build_and_coverage_build`/`dist` already uses. `docs-and-storybook` itself and every
   `visual-regression` shard (point 6) both depend on `docs_build` and download that artifact
   instead of independently rebuilding Storybook from source — three fewer redundant rebuilds per
   run than the previous design. Two independent lanes then run the Storybook contract crawl and
   the Show Code crawl against that same downloaded artifact in parallel; a stable
   `docs-and-storybook` aggregate requires both. The split retains the complete Chromium checks
   while removing their former 214-second + 248-second serial chain from one runner.
6. **`visual-regression`** — blocking as of the 2026-07-20 font-substitution determinism fix (see
   `packages/lyra-ui/visual-baselines/README.md`). The 93 stories expand to 268 axis-level
   captures: 123 compare against tracked baselines and 145 are evidence-only. They are lexically
   sorted and round-robin partitioned across a three-leg matrix (90/89/89 captures), so the
   historical ~3.5min sweep no longer sits on one runner's critical path. Each leg downloads the
   `storybook-static/` artifact `docs_build` (point 5) already built, runs
   `test:visual` with its one-based shard coordinates, and unconditionally uploads a uniquely
   named diff artifact. A lightweight `visual-regression` aggregate preserves the stable
   branch-protection/release-check name and fails unless all three legs succeed.

To reproduce one visual shard after building docs and installing Chromium:

```bash
VISUAL_SHARD_INDEX=1 VISUAL_SHARD_TOTAL=3 \
  pnpm --filter @aceshooting/lyra-ui test:visual
```

Sharding happens after an optional `--filter` and at capture-axis granularity, not story
granularity. The unit test proves every capture is selected exactly once and shard sizes differ by
at most one; an ordinary unsharded local run still exercises all 268 captures.

A separate `platform-contracts` matrix job runs the platform contract suite (`test:platform`) for
Firefox, Chromium, Safari (WebKit), Chrome, and Edge on Node 20 and Node 22. Nine legs use the
pinned Playwright image; only the branded Chrome and Edge legs stay on the runner VM, where browser
setup is cached and apt work is bounded and retried. Every leg installs with `--frozen-lockfile`,
then sets `WTR_BROWSER` and `WTR_STRICT_CONSOLE=1` and runs
`pnpm --filter @aceshooting/lyra-ui test:platform-shard`. Chrome and Edge each run as
Chromium-channel jobs (`WTR_BROWSER=chrome` uses `channel: chrome`; `WTR_BROWSER=edge` uses
`channel: msedge`). Firefox Node 22 is split into four deterministic round-robin shards
(`WTR_SHARD_TOTAL=4`); Chromium Node 22 into two (`WTR_SHARD_TOTAL=2`); Chrome, Edge, and Safari
Node 22 each run single-shard, as do Node 20 Firefox and Safari. Shard counts were tuned from
measured per-leg wall time: the prior 20-leg matrix (8-way Firefox, 4-way Chromium, 2-way
everything else) had most Node 22 legs finishing in 50-110s, of which roughly half was fixed
per-job overhead (checkout/install/browser setup) rather than test execution against the 26-file
`test:platform` suite -- oversharded legs pay that fixed cost repeatedly for little parallelism
gain. Node 20 uses the pnpm version pinned in `.github/ci-pnpm10.json` (`pnpm@10.34.5`); Node 22
uses `package.json#packageManager` (`pnpm@11.25.0`). The package's supported engine remains
`node >=20`; this matrix uses 11 legs total (9 on Node 22, 2 on Node 20), well under the public-repo
20-job throughput limit, so `max-parallel` no longer needs to chase that cap. The Firefox/Node 20
leg runs the same packed contract mode as the primary contract lane: every runtime, install,
declaration, bundle, and framework recipe check at the supported floor, with only the duplicate
ATTW sweep omitted. ATTW uses its own bundled TypeScript resolver, so the four exhaustive Node 22
shards cover that package-level contract without turning Node 20 into the new critical path.

## Scheduled full Firefox/WebKit suite

`.github/workflows/full-engine.yml` complements the fast pull-request matrix with the complete
non-coverage `src/**/*.test.ts` suite in Firefox and WebKit. It runs weekly and can also be started
with `workflow_dispatch`. Each browser is split into eight deterministic cost-balanced shards under
Node 22. The runner discovers and lexically sorts the live test inventory, so every test file runs
exactly once across the eight shards without maintaining a second allowlist. Unknown files have a
unit cost; the package-entrypoint contract has a source-controlled higher cost because importing the
complete unbundled graph takes roughly as long as 50 ordinary files. Greedy least-cost assignment
keeps that graph from dominating one shard while remaining deterministic and exhaustive.

Eight rather than four, and deliberately *more shards* rather than more concurrency inside each
one. The two levers are not equivalent: raising a lane's `WTR_CONCURRENCY` from 4 to 10 was
measured to break `lr-span-waterfall`'s and `lr-test-results`' hover assertions, both of which pass
again at 4 — pointer and paint timing degrades under CPU contention regardless of how many cores
the host has, which is the same reason `scripts/test.sh` pins its lane concurrency. Adding shards
adds processes that each keep CI's per-process shape, so the critical path halves without changing
any test's timing characteristics. This also differs from `platform-contracts`' deliberately
*coarser* matrix: that job runs the 26-file `test:platform` subset, where finer splits lost to
fixed per-job overhead, whereas the complete suite is ~490 files and still leaves ~60 per shard.

Every shard builds first because `package-entrypoints.test.ts` imports the package's built `dist/`
targets. The package's `pretest` lifecycle provides the same build-first guarantee for a clean
`pnpm test`. Each shard then runs with strict browser-console handling. The smaller `test:platform`
matrix in `ci.yml` remains the blocking Node 20/22 pull-request contract and does not substitute
for this complete sweep; releases require a manual-dispatch run from `main` with all eight shards
for both browsers successful for the exact release commit before any tag is created.

To reproduce one shard locally after installing the requested Playwright browser:

```bash
WTR_BROWSER=firefox WTR_STRICT_CONSOLE=1 \
  WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=8 \
  pnpm --filter @aceshooting/lyra-ui test:full-engine-shard
```

Run `pnpm build` first when the selected shard includes package-entrypoint tests. The deterministic
discovery and sharding logic is covered by the package's blocking `test:tooling` suite.

## Manually dispatched five-browser suite

`.github/workflows/test-all-browsers.yml` runs the complete non-coverage suite in Chromium,
Firefox, Chrome, Edge, and Safari (WebKit). Each browser's four existing deterministic shards run on
independent runners through `scripts/test_all_browsers.sh`. The test process and concurrency shape
are unchanged; scheduling the same shards independently removes their former sequential critical
path without raising browser concurrency inside a shard. Five lightweight browser-named aggregate
jobs preserve the stable release checks; the individual worker names expose the exact failed shard.
This four-shard shape is deliberately distinct from `full-engine.yml`'s eight independently-hosted
shards per Firefox/WebKit engine. Manual diagnostic runs may select a subset through the workflow
input, but release qualification always dispatches the complete five-browser list.

For a release, the generated qualification manifest requires all five named browser jobs from one
successful `workflow_dispatch` run whose `head_branch` is `main` and whose `head_sha` is the exact
release commit. A subset run therefore cannot qualify a release even when every job it did create
succeeds.

## Local aggregate: `scripts/ci.sh`

`./scripts/ci.sh` consolidates the six primary jobs into one Node 22/Chromium run. It requires the
exact `22.23.2` patch recorded in `.nvmrc` and pnpm to match `package.json#packageManager`; this
prevents a green run under a different Node 22 patch from being mistaken for the CI environment.
Run `nvm use` before the aggregate. It intentionally reuses one install, one library build, and one
Storybook build where independent CI jobs repeat them.
It also omits external Codecov/upload-artifact reporting actions; the blocking local equivalents
(`check:bundle-size`, coverage, and visual regression) still run. `codecov:bundle` is reporting
only and does not replace the blocking bundle-size gate. The aggregate includes the static job's
networked, content-addressed pinned-upstream-manifest check; an unavailable registry or changed
artifact fails the run instead of silently falling back to a clone-generated manifest. It also runs
the same checksum-pinned actionlint workflow gate as `static-checks`.

- `./scripts/ci.sh --platform` adds the unsharded `test:platform` browser sweep under the active
  Node 22/pnpm 11 toolchain. The 5-browser Node 22 sweep is Firefox, Chromium, Chrome, Edge, and
  Safari. It is useful for broad installed-browser coverage, but it is not the sharded two-Node CI
  matrix.
- When no explicit `WTR_CONCURRENCY` is assigned, the runner preserves Chromium's automatic
  concurrency and caps Firefox/WebKit/Safari at the smaller of four pages or half the available
  CPUs. This preserves low-core hosted-runner behavior while preventing a high-core machine from
  opening dozens of timing-sensitive pointer pages in one process. The shared mouse-command bridge
  foregrounds the requesting page before each Firefox/Chromium pointer action, but leaves WebKit
  pages alone so one test cannot suspend a sibling page by stealing foreground.
- `./scripts/ci.sh --platform-matrix` (or `--all`) runs the primary aggregate and then the exact
  local counterpart of CI's platform matrix. Its 11 legs are source-derived: Node 20 runs Firefox
  (1 shard) and Safari (1 shard); Node 22 runs Chromium (2 shards), Chrome (1 shard), Edge (1 shard),
  Firefox (4 shards), and Safari (1 shard). Node 20 needs pnpm 10.34.5; Node 22 needs pnpm 11.25.0.
  The `CI_SH_NODE20_BIN`, `CI_SH_NODE22_BIN`, `CI_SH_PNPM20_BIN`, and `CI_SH_PNPM22_BIN` overrides
  accept explicit executable paths. For Node 22, the runner accepts only the `.nvmrc` patch
  (`22.23.2`); its Node 20 resolver may select the newest installed Node 20 patch.
- `CI_SH_SKIP_INSTALL=1` skips only the primary dependency installation and Chromium download;
  platform modes still install their own dependencies and requested Playwright engines.
- `--keep-going` aggregates only generated-artifact freshness failures. Real lint, build, test,
  docs, visual, packed-consumer, and platform failures remain fail-fast.

## Full local test sweep: `scripts/test.sh`

`./scripts/test.sh` runs the complete discovered `src/**/*.test.ts` suite (not the curated
`test:platform` subset) on Chromium, Firefox, and WebKit, plus SSR/hydration, visual regression,
and the other workspace package(s)' own tests -- everything `full-engine.yml` covers weekly in CI,
on demand and locally. It deliberately excludes `scripts/ci.sh`'s lint/build-artifact-freshness/
docs-freshness/packed-consumer gates; the two scripts are complementary, not overlapping: `ci.sh`
is the per-commit-equivalent gate, `test.sh` is the pre-publish cross-browser sweep.

Five lanes (`chromium`, `firefox`, `webkit`, `visual`, `workspace`) run as separate background
processes by default, since each drives its own browser/process and the machine's spare cores would
otherwise sit idle running them one at a time. `./scripts/test.sh --serial` runs them one at a time
instead, for lower-core machines. Each lane's own steps still run in order within that lane (for
example the `chromium` lane is `check:component-quality:built` -> `test:ssr` -> `test:hydration` ->
`test:coverage` -> `check:coverage-floors`, covering the same gates while retaining the default
sequential coverage runner); a shared
`pnpm build` runs once up front since every lane needs `dist/` for `package-entrypoints.test.ts`.
Each lane's output is captured to its own log file (path printed at start) so concurrent runs don't
interleave on the terminal; a failing lane's log is printed in full at the end.

The `firefox`/`webkit` lanes run `test:full-engine-shard` with `WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=1`
-- the shard math in `scripts/full-engine-shard.mjs` assigns every discovered file to shard 1 of 1,
so this is the complete suite in one process, not an actual shard. Set
`TEST_SH_ENGINE_SHARDS=<n>` to split each engine lane into `n` parallel shard lanes instead,
mirroring `full-engine.yml`'s own matrix. Each shard lane keeps the tuned per-lane concurrency and
gets its own deterministic port; the default of `1` leaves behavior unchanged. On a many-core host
this is the lever to reach for -- raising `WTR_LANE_CONCURRENCY` instead reintroduces the
hover/paint flakiness described above.

**Shards multiply here; they divide in CI.** Each CI shard owns its own runner, so its
`WTR_CONCURRENCY` is everything that machine runs -- which is why 8 shards per browser is fine
there. Locally every shard is another process on the SAME host, so the concurrent page count is
`shards x 2 engines x per-lane concurrency`. Setting `TEST_SH_ENGINE_SHARDS=8` on a 60-core box
therefore asks for 64 pages and was measured at load 71, i.e. exactly the overcommit that makes
those hover assertions fail spuriously. The script now derives a ceiling from the host CPU count
(budgeting about half the CPUs as browser pages) and clamps an over-large request with a warning
rather than failing, so matching CI's shard *numbering* never costs you a machine-sized
mistake -- on a 60-core host that ceiling is 3. `test:platform`'s 26-file subset
is a strict subset of this run, so it is not run separately here.

Because it's heavy (three full browser-engine sweeps), it is meant to run before publishing a
release, not on every commit -- see [AGENTS.md](../../AGENTS.md)'s "Dev commands and gates" section
and the release checklist in `scripts/publish.sh`.

## Release integrity

`scripts/publish.sh` is self-contained in this repository. It does not read or run a sibling
website checkout; website synchronization is a separate, opt-in post-release operation. It refuses
to start from a dirty tree, requires one canonical fetch URL and one canonical push URL, and keeps
the maintainer GitHub token out of dependency and package lifecycle processes. Changesets may
auto-expand the release to publishable dependents; every actual package-version delta is therefore
generated, tested, reviewed, packed, tagged, and released. Only stable core `major.minor.patch`
versions are accepted. Package ownership is derived from `pnpm changeset status --output`, so the
release script accepts every frontmatter spelling that Changesets itself accepts, including
single-quoted package names.

For each released package it regenerates package, component, manifest, default-string, framework,
design-token, editor, and LLM artifacts, then runs lint → build → component-quality → test. It
updates the narrowly anchored README source-version line (which deliberately makes no pre-publish
registry claim). For a lyra-ui release it also synchronizes the Claude and Codex plugin manifests
plus the version-bearing Claude marketplace entry, regenerates the plugin references and standalone
skill archives, and verifies the complete plugin contract. It then shows the complete clean-start
worktree and diff stat before confirmation. Packing reruns the same deterministic lifecycle. The
script stages the full version-derived CEM, inventory, quality, editor, framework, token, LLM, and
plugin set; any other unstaged tracked output aborts for review. A flags-only release does not touch
the lyra-ui plugin.

The release commit is pushed alone to `origin/main`, which starts CI. The script dispatches
`test-all-browsers.yml` and `full-engine.yml` from `main`, then requires the exact-SHA `push`/`main`
CI run plus exact-SHA `workflow_dispatch`/`main` runs for both browser workflows. It creates no tag
unless all three runs qualify. Only then does it create annotated tags, push the multi-package tag
set atomically, and create the GitHub Releases that trigger `publish.yml`. Recovery output is
phase-aware and never suggests a release after failed qualification.

The read-only publish verification job rejects a lightweight tag, verifies the annotated tag's
peeled commit is both the exact checkout and the workflow invocation ref/SHA, then waits for one
successful `push`/`main` `ci.yml` run and successful `workflow_dispatch`/`main` runs for
`test-all-browsers.yml` and `full-engine.yml`, all with that commit as `head_sha`. A manual
invocation must therefore be dispatched on the tag itself (for example,
`gh workflow run publish.yml --ref <tag> -f tag=<tag>`), not on the default branch. Each run must
contain
successful results for every job marked `release-qualification: required` or
`release-qualification: matrix` in the workflow, and every job present in its run must succeed
so a future gate cannot be added without becoming release-blocking. The exact expanded job names
live in `.github/release-qualification.json`; `generate-release-qualification.mjs --check` derives
them from all three workflow files and makes matrix or display-name drift a freshness failure. The
Test All Browsers run must contain Chromium, Firefox, Chrome, Edge, and Safari; the full-engine run
must contain all eight Firefox and all eight WebKit shards, with every job successful.
The helper deliberately reads the named workflow runs and their jobs, not every check on the commit:
the latter set includes the currently-running publish job and would deadlock on itself. Its pure
state-machine, tag, and
tarball checks live in `scripts/release-integrity.test.mjs`.

The `npm-publish` GitHub environment is an external repository setting, not something workflow
YAML can create. It must retain required reviewers; verify it before a release with
`gh api repos/aceshooting/lyra-ui/environments/npm-publish`. Credentials are minted only after
that deployment gate. Before the gate, a read-only job requires exactly one `.tgz`, validates its
embedded identity, rebuilds the exact tagged source, byte-compares both tarballs, and uploads the
verified bytes plus digest as a 14-day workflow artifact. The protected job has no checkout,
dependency install, package lifecycle, or repository-script execution. It downloads that artifact,
rechecks the digest and peeled remote tag, clobbers and round-trips the GitHub Release tarball to
close the approval-window mutation gap, then attests and passes those same bytes to `npm publish`.
A manual dry run validates and passes that same existing release asset to
`npm publish --dry-run` without attesting or publishing it. The attached provenance file keeps the
action's native Sigstore-bundle JSON representation and `.sigstore.json` suffix; it is not copied
under an in-toto JSONL suffix, which is a different serialization.

`publish.yml` and the manual `sign-release.yml` recovery path both call
`release-verification.yml`; this is the single read-only rebuild/byte-verification implementation.
The recovery path retains the same
14-day artifact handoff, protected minimal signer, post-approval tag check, and release-asset
round-trip. Dispatch it on the requested tag, never on `main`.

Component release history checks require a non-shallow clone with tags; every CI lint worker uses
`fetch-depth: 0`. `history.taggedCurrent` preserves the immutable current-version tag record while
mutable worktree `history.current` evolves. APIs added after that tag are marked `unreleased`, then
receive the bumped version when the exact tag snapshot rolls into `history.releases`.

The packed-consumer CI job runs the networked `check:public-api` after building. It downloads the
latest published package, validates and safely unpacks its tarball in a temporary directory, then
normalizes CEM, concrete wildcard exports, framework declarations, named-export declaration
graphs, reachable event-detail types, and documented event cancelability. Removals, narrowing,
default/reflection/event changes require a major bump; additive or widening changes require at
least a minor bump. Pending Changesets must meet that minimum unless an exact, reviewed exception
in `scripts/public-api-semver-exceptions.json` matches the before/after values. Parser and semver
logic remain network-free under `test:public-api`.

Current release-integrity caveats and operational rules:

- `.changeset/config.json`'s `"updateInternalDependencies": "patch"` only governs regular
  `dependencies`/`devDependencies`. `@aceshooting/lyra-ui`'s `peerDependency` on
  `@aceshooting/lyra-flags` (`workspace:^x.y.z`) escalates to a **major** bump the moment that
  peer's own version changes in the same `pnpm changeset version` run, regardless of what severity
  the pending changesets actually declare for lyra-ui. Only fires when lyra-flags' own version
  changes in that round; an all-lyra-ui round bumps cleanly.
- **The same regeneration is owed by ANY change under `src/`, not just a version bump — and not just
  changes to shipped code.** `generate-component-quality.mjs` measures two things a source diff does
  not obviously touch: the _built_ per-component gzip size (so it reads `dist/`, and needs a fresh
  build first) and per-component _test_ quality (so it reads `src/**/*.test.ts` too). Both bit this
  repo in sequence on 2026-08-12: a one-method source fix, then a test-only edit, each turned CI's
  `lint` job red with `component-qualification.json: stale or missing` after local `pnpm lint` had
  passed. Critically, `pnpm manifest` came back **byte-identical** both times, which made each
  change look artifact-neutral — a clean manifest is not evidence that component-quality is clean.
  Rule of thumb: touched anything under `src/`? rebuild, then rerun
  `generate-component-quality.mjs --write --measure-gzip` before committing.
- **The measured gzip bytes are Node-patch-sensitive, so regenerate them on the exact Node version
  CI uses.** The measurement is esbuild-bundle-then-gzip, and the gzip half runs through Node's
  bundled zlib — which is not byte-identical across Node patch releases. A build regenerated on
  Node 22.22.1 was rejected by CI's exact `.nvmrc` Node 22.23.2 run even though
  `--check --measure-gzip` passed locally. esbuild was identical and pinned; only zlib differed.
  Run `nvm use` and regenerate under the checked-in patch.
  A remote build box is the usual place this bites, since its Node rarely matches the runner's.
- **Regenerate component-quality LAST, after every other generator.** Several generators write into
  `src/` — `generate-default-string-slices.mjs --write` rewrites the per-component slice block in
  each class file, and moves it to the top of the class if something was inserted above it. Running
  it after the gzip measurement silently invalidates that measurement, which is how the same CI job
  failed a third time on 2026-08-18. Order: manifest, framework-types, default-string-slices,
  component-inventory, component-metadata, `./package.sh`, build, *then* component-quality.
- **`./scripts/ci.sh` is Chromium-only, so it cannot see a contract that is entirely absent on
  another engine.** On 2026-08-12 `lr-zoomable-frame`'s host `focus`/`blur` forwarding re-dispatched
  nothing at all on Firefox — that engine dispatches neither `focus` nor `focusin` on an `<iframe>`
  ELEMENT for a programmatic `.focus()`, moving focus into the frame's own document instead. The
  element still became `shadowRoot.activeElement`, so the assertion that focus _moved_ passed and
  only the missing events failed. Anything that wraps an `<iframe>`, or that re-emits a
  non-composed native event, needs a `WTR_BROWSER=firefox`/`webkit` run before it is believed;
  `pnpm exec wtr --files <path>` accepts that env var per file, and a full local sweep on one engine
  is far cheaper than a `workflow_dispatch` round trip. It also sees what CI's _sharding_ can hide:
  the same sweep surfaced a second, unrelated load-sensitive timeout that the sharded run missed.

## Coverage floors (`scripts/coverage-floors.json`)

`web-test-runner.config.js` reads its blocking per-metric thresholds from
`packages/lyra-ui/scripts/coverage-floors.json` rather than from literals in the runner config. The
file is generated: `node scripts/write-coverage-floors.mjs --write-floors` (from `packages/lyra-ui`,
after a `test:coverage` run has written `coverage/`) sets each metric to
`floor(measured − margin)`, default margin 1.5 points, and records the measurement and date it used
alongside the floors.

- `pnpm --filter @aceshooting/lyra-ui check:coverage-floors` is the non-mutating mode. Locally it
  runs after `test:coverage`; CI runs it after the four raw shard artifacts pass fail-closed merge
  validation. It fails both ways: a floor **above** the measurement (the suite cannot pass) and a
  floor more than 5 points **below** it (the floor stopped gating anything).
- `--write-floors` never lowers a floor without `--allow-lower`, so a coverage regression is an
  explicit line in the diff rather than a silent re-baseline by whoever last ran the command.
- Why generated at all: the hand-edited floors had drifted to statements 75 / branches 65 /
  functions 65 / lines 75 while the suite was measuring 99 / 94 / 99 / 99 — roughly a quarter of the
  source tree could have gone uncovered without the gate firing. A floor is only a gate while it
  sits just under the measurement, and it only stays there if refreshing it is one mechanical
  command producing a reviewable diff.
- **The mirror-image failure is a threshold set _tighter_ than measurement from day one** — an
  "aspirational" budget that's red the moment it lands, which trains everyone to ignore that gate
  entirely rather than fix it. This has recurred independently in the package-size budget
  (`check:package-size`'s minimum-reduction figure) and the qualification axe scanner's evidence
  requirements. The package gate's reviewed exception and hard ceilings are detailed in
  "Package-delivery budget" below; qualification thresholds are measurement-derived, matching the
  floors approach above. Any new budget/threshold should start from a measured baseline, not a
  target number picked in advance.
- It prefers `coverage/coverage-summary.json` (exact statement totals) and falls back to
  `coverage/lcov.info`, which carries no statement records — in that mode the statements figure
  reuses the line figure, and the script says so.

## Package-delivery budget

`pnpm --filter @aceshooting/lyra-ui check:package-size` measures `npm pack --dry-run --json
--ignore-scripts` after a build and fails closed against `scripts/package-budgets.json`. The
pre-8.0.0 baseline is 7,829,794 packed bytes, 38,510,084 unpacked bytes, and 4,441 files. The 25%
unpacked reduction is a hard requirement: its ceiling may not exceed 28,882,563 bytes. Source and
map rejection is independent, so staying below a byte ceiling can never excuse a dangling map or a
published TypeScript source file.

The packed 25% target remains recorded as 5,872,345 bytes, but it has one explicit measured
exception; the gate never claims that target was met. A deliberately favorable lower-bound probe
kept all required consumer docs, editor data, and custom-elements metadata, fully
identifier-minified the runtime JavaScript, and omitted declarations, CSS, and other required
runtime artifacts. Even that incomplete package was 6,088,928 packed bytes — 216,583 bytes over
the target before restoring the omitted public artifacts. Deleting those artifacts or weakening
their content is not an acceptable package-size fix.

The exception therefore uses a hard measurement-derived regression ceiling. Initial authored
documentation corrections and canonical regeneration grew the required public payload by 3,688
packed bytes and 14,084 unpacked bytes from the prior reviewed complete package, including the
14,080-byte growth of `llms-full.txt`, producing a 6,929,625-byte reviewed measurement. Later
integrated generated output consumed part of that headroom. The final manifest-driven IDL-default
documentation sweep adds 4,394 required unpacked bytes across `llms-full.txt` and 17 self-contained
component references without adding package files. Exact Node 22.23.2/npm 10.9.8 packs move from
6,932,102 packed / 28,851,327 unpacked bytes at the parent commit to 6,933,420 packed / 28,855,721
unpacked bytes now. The complete required package is therefore re-reviewed at 6,933,420 packed
bytes, and its 6,936,335-byte ceiling retains exactly 2,915 bytes (0.042%) of tool/version headroom.
`validatePackageBudgets()` rejects a missing/renamed exception, a probe that does not exceed the
mathematical target, headroom over 0.5%, or a ceiling that is not exactly the reviewed measurement
plus headroom. Any future ceiling increase needs a new reproducible measurement and review
rationale; never edit the number merely to make a red check green.

The file-count ceiling is derived, not an already-consumed snapshot: 2,500 base artifacts, two
emitted files for each of the 285 stable tag aliases, the measured 82-file entrypoint remainder,
and seven non-alias files reserved for the next component scaffold. Incrementing the stable alias
count budgets that component's two alias files separately. Validation requires the reserve to be
positive and the 3,159-file ceiling to equal that derivation, so a legitimate new component has
room while unrelated inventory growth still fails closed.

## `tsconfig.build.json` and dist hygiene

`pnpm --filter @aceshooting/lyra-ui build` is `scripts/build.mjs`, which runs
`tsc -p tsconfig.build.json` — **not** `tsconfig.json`. `tsconfig.build.json` is that file with
`sourceMap` and `declarationMap` off, because `package.json#files` publishes `dist` and not `src`:
every emitted map pointed at a `../../../../src/**/*.ts` path that does not exist in an install and
carried no `sourcesContent`. That was 2070 files and roughly 13 MB of tarball (`dist` 32M → 19M),
and `declarationMap` was worse than dead weight — it routes an editor's Go-to-Definition at the
missing `.ts` and fails there instead of falling back to the readable `.d.ts` beside it. Maps stay
**on** in `tsconfig.json`, so local type-checking, `tsconfig.type-tests.json`, docs, and ad-hoc
`tsc` debugging are unaffected.

`scripts/check-build-artifacts.mjs` (chained into `build`, also `pnpm run check:build-artifacts`)
asserts the result on the emitted bytes rather than on the config that produced them, so it survives
any change in how the build is spelled: it fails on any `.map` under `dist`, and separately on any
emitted `.js`/`.d.ts`/`.css` carrying a `sourceMappingURL` comment (a referenced-then-pruned map,
which leaves consumers' devtools chasing a 404). The script entry also runs the AI compile-contract
test after those byte checks, so a no-emit assertion file cannot silently reappear in source,
`dist`, the exported subpath surface, or the packed file list.

## `prepack` and editor data

**`prepack`** (`package-metadata` → `default-string-slices` → `manifest` → `framework-types` →
`design-tokens` → `build` → `generate-editor-data` → `llms`; `packages/lyra-ui/package.json`)
determines tarball contents on `npm pack`/`npm publish`, run by npm itself rather than as one
monolithic CI command. Starting with `package-metadata` prevents a version bump from packing stale
runtime version constants. `generate-editor-data` regenerates
`vscode-html-data.json`, `vscode-css-data.json`, and `web-types.json` from
`custom-elements.json`.

The generated public-surface outputs are CI-gated across the lint and static jobs. In
`static-checks`, the manifest is regenerated and diffed before editor data is regenerated and
diffed; `.github/workflows/ci.yml` remains the authority for the exact commands. The ordering
matters because editor data is derived _from_ `custom-elements.json`: a stale manifest reddens the
first diff and editor-data generation then runs against the corrected manifest. Framework type and
LLM freshness are enforced inside `pnpm lint`. Locally, regenerate in dependency order and commit
the complete set whenever you touch the public surface (JSDoc, attributes, parts, or CSS
properties); running only one generator leaves downstream outputs stale.

## Other package-local gates

Defer to `ci.yml` and `package.json#scripts` for when each runs:

- `node scripts/check-source-policy.mjs` fails on banned source patterns (including the
  `localize()` literal-fallback mistake described in
  [i18n-rtl-theming.md](i18n-rtl-theming.md)).
- `node scripts/check-bundle-size.mjs` bundles the published entry points after a build, fails on
  gzip-size regressions against `scripts/bundle-budgets.json`, and re-measures every
  per-component entry so the sizes in `scripts/bundle-stats.json` (read by the README size badges
  and the lyra-ui.com hero) cannot go stale — refresh measured statistics with `--write-stats`.
  Every hard entry and component-aggregate ceiling is paired with its exact reviewed gzip byte
  measurement. The schema fails closed if either side is missing, if a ceiling is already below its
  measurement, or if it carries more than 4% headroom. `--print-budget-review` emits a read-only
  exact-measurement/maximum-ceiling proposal after the integrated source set is final; it never
  writes or loosens policy, and an existing tighter canary stays tighter unless separately reviewed.
- `pnpm test:visual` runs the visual-regression screenshot suite against `visual-baselines/`.

`check:hit-area` (WCAG 2.5.8 tappable-size floor) and `check:numeric-guards` (finite-number guards
on numeric properties) are now blocking parts of `contract-policy`; both currently pass with all
known exceptions explicit. Don't assume a check doesn't exist just because it is not listed here —
`ls packages/lyra-ui/scripts/check-*.mjs` is the real inventory. `pnpm run check:script-paths` guards
the inverse mistake (a `package.json` script naming a literal source path that no longer exists):
it exists because `test:platform` kept 21 hardcoded test paths across the 11-family restructure —
20 stopped resolving, `wtr` silently dropped them rather than erroring, and the Firefox/WebKit
matrix reported green while running one test file out of 21 for an extended period.
