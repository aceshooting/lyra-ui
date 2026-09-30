# CI, lint gates, and release plumbing — lyra-ui agent reference

> Detail behind the "Dev commands and gates" section of [AGENTS.md](../../AGENTS.md). The digest
> there is the contract; this file carries the full gate lists, ordering rationale, and incidents.

## Remote test workspace hygiene

Use `ssh cygnus` for contributor builds, tests, and benchmarks. Treat task directories under
`~/work` as disposable: after verification and a successful commit/push, remove the task's
checkouts, build outputs, logs, downloaded toolchains, and caches. Check for active processes and
uncommitted changes first. Preserve any unreleased source changes and useful test evidence in a
small local recovery archive before deleting them from Cygnus; do not leave large test trees on
its limited disk or remove another active task's files.

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

## `pnpm regen`: the single regeneration command

`contract-policy` pairs a committed artifact with a freshness gate roughly twenty times over —
manifest, framework types, events, the testing event registry, component metadata, component
inventory, tag aliases, registration artifacts/graph, the autoloader manifest, default-string and
translation slices, the three palette generators, design tokens, reservation styles, and more. Each
gate fails with its own "X is stale; run `pnpm run Y`", but nothing previously forced any single
command to run all of them in the right order — the order lived only in a human's memory, which is
how `registration-graph` was simply left off a remembered list and burned a full `pnpm lint` run to
discover.

**`pnpm run regen` (`packages/lyra-ui/package.json#scripts.regen`) is that command.** It chains every
generator's own named script (`pnpm run manifest`, `pnpm run tag-aliases`, …) in real dependency
order — never a re-spelled `node scripts/...` path, so the chain cannot drift from what each script
actually does. Read the script itself for the exact order and the dependency reasoning belongs there,
not here in prose a second time; a prose copy of the order is exactly what caused the drift `pnpm
regen` exists to fix.

Two steps are deliberately **not** part of `regen`, and must still be run separately, in this order,
after it:

1. **`pnpm build`, before `component-quality`.** `component-quality` (`generate-component-quality.mjs
   --write --measure-gzip`) measures the _built_ `dist/` output's gzip size and reads
   `src/**/*.test.ts` for test-quality scoring — it needs a fresh build to measure, and running it
   before one, or before a later regen step edits `src/`, produces a stale or wrong measurement (see
   "Regenerate component-quality LAST" below).
2. **`./package.sh`, afterwards.** It regenerates `packages/lyra-ui/llms/` (already covered by
   `regen`'s own `llms` step) and then repackages the plugin's `skills/lyra-ui/references/` and the
   standalone skill archives from that fresh `llms/` output — CI's `static-checks` job diffs those
   packaged artifacts, and `regen` has no reason to know about packaging.

`scripts/check-regen-coverage.mjs` (`pnpm run check:regen-coverage`, plus its colocated
`check-regen-coverage.test.mjs` via `pnpm run test:regen-coverage`; both chained into
`contract-policy`) is what keeps `regen` from silently falling behind again. It never hand-lists
"the generators" — that list is exactly the thing that goes stale. Instead it derives required
generators from the gates themselves, three mechanical ways: a same-file `--check`/write argument
pair (how it catches `generate-registration-graph.mjs` and `build-testing-event-registry.mjs`
without either script's name resembling the other), a gate's own backtick-quoted `pnpm run <name>`
(or `pnpm --filter <pkg> <name>`) remedy text, and a gate that imports or string-references a
generator file directly (`check-tag-aliases.mjs` importing `./generate-tag-aliases.mjs`,
`check-palette-freshness.mjs`'s `PALETTE_GENERATORS` array). Every generator file surfaced any of
those three ways must then be reachable by recursively expanding `pnpm run` references from `regen`,
or carry a one-line reasoned exemption in `check-regen-coverage.mjs`'s own `EXEMPTIONS` map — an
exemption with no reason fails the gate outright. The current exemptions are `component-quality` and
`build` itself (both above), the pinned-manifest-only `component-inventory.mjs` library CLI (the
committed artifact is produced by the network-verified `component-inventory` script instead), the two
manual/occasional viewer fixture generators, `generate-theme-bootstrap.mjs` (a `dist/`-only build
output, regenerated inside `scripts/build.mjs` itself), `generate-side-effects.mjs` (already invoked
internally by `registrations`), `component-metadata:history` (a manual git-history reconciliation),
and `coverage-floors` (reviewed limits, not derived output — already outside `contract-policy` for
the same reason).

**Composable styling and the token grammar.** Author shared theme inputs in
`tokens/canonical-tokens.json`, looks in `tokens/looks/*.json`, and the density and glass treatments
in `tokens/density.json` and `tokens/surfaces/glass.json`. `pnpm run style-axes` generates the
production theme, optional look/surface/density/accent stylesheets, runtime look definitions and the
style model embedded in `theme.ts`; `check:style-axes` in `contract-policy` fails when any
projection is stale. Edit the token sources and regenerate these outputs instead of hand-editing
them. The runtime API is `setLyraStyle()`/`getLyraStyle()`/`resetLyraStyle()` from `theme.js`, with
`defineLyraLook()` for runtime look definitions; there is no theme-preset generator or preset
facade.

The token grammar has one source, `scripts/fixtures/theme-token-grammar.json`: `theme.ts` carries
two literal copies (runtime and self-contained bootstrap), and `scripts/theme-token-grammar.mjs`
builds the generator validator from the fixture. `scripts/theme-token-grammar.test.mjs` (in
`test:tooling`) fails when either copy drifts or when the fixture's mode-default reference colours
drift from `theme.css`. The bootstrap's shipped bytes have their own ceiling,
`scripts/theme-bootstrap-budget.json`, enforced by `check:theme-bootstrap` (chained into `build`)
together with an inline-script safety check (`</`, `<!--`, `<script`, raw U+2028/U+2029); it is not
in `bundle-budgets.json` because `check-bundle-size.mjs` re-minifies, and raising it needs a reviewed
re-measurement.

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

   Hosted command costs are periodically remeasured for the weighted partition; the tests require
   every current command to occur exactly once and keep estimated lane weights balanced. Local
   `pnpm lint`, `scripts/ci.sh`, and release generation remain complete and sequential. The shard
   entry is CI-only. No lint lane needs Playwright or a build because every command is static analysis.
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
   roughly 7–8 minutes after fixed checkout/install/artifact overhead. Four is the useful split:
   finer shards would add another full runner bootstrap per slice and compete with the workflow's
   other matrices for the public-runner concurrency cap.

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
   contract and packed-size budget. Only ATTW is skipped in this lane. ATTW's 2,435 package
   export entries are sorted and round-robin partitioned across sixteen runners (three with 153
   entries and thirteen with 152). The inventory is derived from the current exports map, excluding
   CSS and the classic-script bootstrap asset. One producer runs real `pnpm pack`, verifies tracked-source freshness,
   and uploads the tarball with its SHA-256 checksum. Every worker verifies those same bytes and
   checks the packed name, version, and ordered exports against its checkout before selecting its
   partition. The 12-minute worker limit is unchanged; a measured 171-route partition took 4m55s,
   whereas eight-way partitions took up to 10m42s before installation overhead. In parallel, the
   public-API lane consumes the shared dist artifact from `build_and_coverage_build` and runs the
   networked public-API semver gate. The aggregate requires the contract lane, all sixteen ATTW
   shards (which require the package producer), and the public-API
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
   `packages/lyra-ui/visual-baselines/README.md`). The 111 stories expand to 321 axis-level
   captures: 114 compare against tracked baselines and 207 are evidence-only. They are lexically
   sorted and round-robin partitioned across a three-leg matrix (107/107/107 captures), so the
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
at most one; an ordinary unsharded local run still exercises all 321 captures.

A separate `platform-contracts` matrix runs the curated contract suite in nine Node 22 legs:
Chromium in two shards, Firefox in four, and Chrome, Edge and Safari (WebKit) in one each.
Seven legs use the pinned Playwright image; branded Chrome and Edge use the runner VM with
bounded browser setup. Every leg installs with `--frozen-lockfile` and enables strict browser
console checking. The primary packed-consumer jobs cover the supported Node floor, declarations,
tree shaking and framework recipes without repeating that package matrix in each browser leg.
Node 22 uses `package.json#packageManager` (`pnpm@12.6.0`).

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
*coarser* matrix: that job runs the 35-file `test:platform` subset, where finer splits lost to
fixed per-job overhead, whereas the complete suite is ~490 files and still leaves ~60 per shard.

Every shard builds first because `package-entrypoints.test.ts` imports the package's built `dist/`
targets. The package's `pretest` lifecycle provides the same build-first guarantee for a clean
`pnpm test`. Each shard then runs with strict browser-console handling. The smaller `test:platform`
matrix in `ci.yml` remains the blocking Node 22 pull-request contract and does not substitute
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
  Node 22/pnpm 12 toolchain. The 5-browser Node 22 sweep is Firefox, Chromium, Chrome, Edge, and
  Safari. It covers every installed browser in an unsharded run.
- Firefox runs one test page per browser process, including when `WTR_CONCURRENCY` requests more.
  Its native pointer capture crosses separate browser contexts, so concurrent page gestures can
  release or intercept each other's input. Existing process shards retain parallel execution.
  When no explicit concurrency is assigned, Chromium retains its automatic default and
  WebKit/Safari retain the smaller of four pages or half the available CPUs. The aggregate runner
  budgets shard pages from the sum of Firefox's one-page and WebKit's four-page allocations.
- `./scripts/ci.sh --platform-matrix` (or `--all`) runs the primary aggregate and the same nine
  Node 22 browser/shard legs as CI. Node 22 needs pnpm 12.6.0.
  Its 9 legs are source-derived: Node 22 runs Chromium (2 shards), Chrome (1 shard), Edge (1 shard),
  Firefox (4 shards), and Safari (1 shard).
  `CI_SH_NODE22_BIN` and `CI_SH_PNPM22_BIN` accept explicit executable paths; the selected Node
  must match the exact `.nvmrc` patch (`22.23.2`).
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
`shards x (Firefox pages + WebKit pages)`. The former four-page allocation for both engines made
`TEST_SH_ENGINE_SHARDS=8` request 64 pages on a 60-core box and was measured at load 71. The current
one-page Firefox and four-page WebKit allocations request 40 pages for eight shards. The script
budgets about half the host's CPUs as browser pages and clamps an over-large request with a warning
rather than failing. On a 60-core host the current ceiling is six shards per engine, or 30 pages;
all positive shard counts are supported. `test:platform`'s 35-file subset
is a strict subset of this run, so it is not run separately here.

Because it's heavy (three full browser-engine sweeps), it is meant to run before publishing a
release, not on every commit -- see [AGENTS.md](../../AGENTS.md)'s "Dev commands and gates" section
and the release flow below.

## Release integrity

Releases run in four steps; nothing is tagged or published from a workstation.

1. **Prepare locally.** `pnpm release:prepare` (`scripts/release-prepare.mjs`) requires the exact
   `.nvmrc` Node patch, a clean tree, and a HEAD containing `origin/main`. It fetches `origin/main`
   and published tags before bumping, refusing to overwrite conflicting local tags. It consumes every
   pending changeset with `pnpm changeset version` and refreshes the lockfile with `pnpm install`.
   The script's `PACKAGE_GENERATORS` defines the exact generation order: preserve immutable tagged
   history, stamp metadata, regenerate API and consumer references, then build and measure each
   released package. A lyra-ui release then syncs
   the Claude/Codex plugin versions, runs `./package.sh`, and rebuilds and remeasures because
   `package.sh` writes source. `node scripts/update-readme-status.mjs` runs last. The script never
   lints, tests, packs, commits, tags, or pushes. Changesets can auto-expand a release to a
   publishable dependent; the package-version delta, not the changeset list, is the release set.
   Only stable `major.minor.patch` versions are accepted.
2. **Commit and qualify.** Review the diff, commit it as `chore(release): <pkg>@<version>`, and push
   to main. Push CI runs on that commit; dispatch `test-all-browsers.yml` (all five browsers) and
   `full-engine.yml` on main for the same commit. Any failure is fixed with a new commit, and the
   new HEAD is requalified.
3. **Release on GitHub.** `gh workflow run release.yml --ref main` plans one
   `<directory>@<version>` tag per publishable package whose committed version has no tag yet (a
   named `package` input must be unreleased), and requires the exact-SHA `push`/`main` CI run and
   `workflow_dispatch`/`main` runs of both browser workflows through `release-integrity.mjs`. A
   credential-free job packs each tarball with the pinned Node and pnpm, using the same command the
   publish verification rebuilds with, and fails if packing changes tracked files. A job with no
   checkout then pushes the annotated tags atomically, creates each GitHub Release with the
   tarball, `CHANGELOG.md`, `custom-elements.json`, `llms.txt`, and `llms-full.txt`, and dispatches
   `publish.yml` on each tag. A release created with `GITHUB_TOKEN` emits no `release: published`
   event to other workflows, so that dispatch is the only publish trigger.
4. **Publish.** Approve the `npm-publish` environment on each Publish run, then deploy the website
   so `release-feed-freshness.yml` can confirm the upgrade feed matches npm.

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
--ignore-scripts` after a build and fails closed against `scripts/package-budgets.json`. The fixed
pre-8.0.0 baseline is 7,829,794 packed bytes, 38,510,084 unpacked bytes, and 4,441 files. The 25%
targets remain 5,872,345 packed bytes and 28,882,563 unpacked bytes. Both byte budgets currently
use explicit measured required-public-artifact exceptions; the gate reports those exceptions
instead of claiming either mathematical target was met. Without the unpacked exception, its
ceiling must satisfy the 25% target. Source, map, fixture, test, and story rejection remains
independent of every size ceiling.

The packed exception retains its favorable lower-bound probe: all required consumer docs, editor
data, and custom-elements metadata plus fully identifier-minified runtime JavaScript still packed
to 6,088,928 bytes, already 216,583 bytes above its mathematical target before restoring omitted
declarations, CSS, and other required runtime artifacts. Deleting those public artifacts or
weakening their content is not an acceptable package-size fix.

The complete 22.0.0 package produced by normal `pnpm pack` with Node 22.23.2 contains
7,653,029 packed bytes, 34,854,812 unpacked bytes, and 4,072 files. Published 21.2.0 contains
9,474,876 packed bytes, 38,652,973 unpacked bytes, and 4,195 files: reductions of 19.2%, 9.8%,
and 123 files respectively. Package-only filesystem allocation on the same filesystem falls from
52,895,744 to 47,738,880 bytes; these installed figures exclude dependencies. The final unpacked
package is also 9.5% below the historical 38,510,084-byte baseline. Declaration consolidation keeps
all JavaScript routes and public types, directs transparent registration aliases to their canonical
declarations, and shares one empty declaration for side-effect-only locale entries. Pseudo-locale
exports retain their declarations.

Production browser bundles measured with the same esbuild 0.28.1 settings, shared locked dependency
versions, ES2022 target, and gzip level 9 show the following registration-entry sizes. Optional peers
are externalized according to each package's declarations; these figures exclude stylesheets.

| Entry | 21.2.0 minified / gzip bytes | 22.0.0 minified / gzip bytes | Gzip change |
| --- | ---: | ---: | ---: |
| badge | 98,364 / 24,747 | 91,140 / 21,788 | -12.0% |
| button | 134,018 / 33,545 | 127,428 / 30,579 | -8.8% |
| input | 156,585 / 40,350 | 149,294 / 37,247 | -7.7% |
| card | 114,492 / 29,556 | 107,228 / 26,551 | -10.2% |
| tooltip | 199,064 / 55,662 | 197,128 / 54,268 | -2.5% |
| popover | 190,744 / 53,650 | 190,571 / 52,915 | -1.4% |

The button/input/card/tooltip composition falls from 81,389 to 79,846 gzip bytes. The complete
registration bundle grows from 1,175,692 to 1,186,596 gzip bytes (0.9%) while adding eight components;
code-block-core grows 0.3%. Whole-bundle figures sum independently compressed emitted chunks,
including deferred chunks. The optional locale loader's initial static closure is 3,057 minified /
1,468 gzip bytes; its 66 catalog imports remain deferred. Its generated catalog map is absent from
the default component and root import graphs.

The expanded style system has a separate cost: theme.css grows from 2,902 to 6,963 gzip bytes, and
the standalone theme bootstrap grows from 3,980 to 6,088 gzip bytes with versioned sparse and nested
ownership. These increases are reported separately from the package reduction. All figures describe production artifacts, not source-line counts.

The byte ceilings are the exact reviewed measurements plus 33,960 packed and
139,713 unpacked headroom bytes: 7,686,989 and 34,994,525 bytes respectively. Both ceilings are below
the historical baseline, so the former baseline-overage approvals are no longer needed. The separate
25%-target required-artifact exceptions remain explicit. `validatePackageBudgets()` rejects a missing
or renamed exception, an unpacked reviewed measurement that no longer exceeds its target, a packed
measurement at or below the recorded favorable probe, headroom above 0.5%, and a ceiling differing
from measurement plus headroom. A ceiling at or above the historical baseline requires a separate
named review; no such approval is active. Raising a ceiling merely to clear a failure is insufficient.

The file ceiling is 4,095: 2,500 base artifacts, one emitted JavaScript file for each of the 304 stable
tag aliases, a measured 1,284-file remainder, and the existing seven-file reserve for the next
component scaffold. The remainder was measured at 1,268 in the previous package review; since then,
nine required runtime modules add 18 emitted files (JavaScript and declarations): `input-shared`,
`custom-element-upgrade-observer`, `icon-only-content`, `native-modal-carrier` and its styles,
`native-modal-context`, and the `data`, `high-contrast`, and `terminal` theme looks. Retiring
`utilities/localization` removes its JavaScript and declaration files, for a net increase of 16.
Canonical declarations supply alias types without an extra declaration per alias. Validation
requires this exact derivation and a ceiling below the historical 4,441-file baseline.

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

The 22.0.0 bundle review keeps those measurement options unchanged. A direct entry-point bundle
preserves all exports and inlines relative dynamic imports; `all.js` also re-exports the root API.
That gate measures 1,271,937 gzip bytes, versus 1,261,698 for published 21.2.0. It differs from the
side-effect-only, split-chunk consumer measurement in the package-delivery table: unused named
exports can disappear there, and chunks are compressed separately. Neither number replaces the
other. Theme runtime and preset growth cover independent style axes, nested ownership and legacy
adapters; localization growth covers delta catalogs and stable canonical aliases. Aggregate entry
ceilings include the new agent components and shared glass/preference behavior.

The initial-route shell falls from 53,754 to 50,602 gzip bytes after collection support moves out of
the common element base. Controls needing that support still load it, so their marginal costs rise
even when complete routes shrink. The select route changes by +91 bytes and combobox by -134;
other non-menu/model ceilings stay within the old absolute route allowance, with at most 2% new
marginal headroom. Model-select's actual +225-byte route increase is explicitly retained with a
19,859-byte marginal ceiling; a baseline-only ceiling would leave just three bytes of drift room.
Menu's actual +1,608-byte route increase includes shared glass-surface styling and is separately
reviewed, with a 15,983-byte marginal ceiling. These are acknowledged feature costs, not savings
from a changed baseline. Time-input's loose 24 KiB ceiling tightens to 22,496 bytes.

The native-modal and overlay correctness changes retain the same measurement options, optional-peer
exclusions and initial-route shell. Reviewed total gzip measurements are 75,505 bytes for combobox,
67,512 for select, 139,680 for the overlays family and 139,002 for utility. Their new ceilings use
`floor(measuredBytes * 1.02)`. These costs cover native modal context and carrier handling, helper
focus scope, top-layer placement, deferred focus return and shadow-content label updates. Tour
already imported the overlay manager eagerly; its additional carrier, top-layer escape and focus
return behavior does not introduce a new third-party dependency.

The six changed initial marginal measurements are tool-call-chip 6,879 bytes, app-rail-item 4,617,
citation-badge 5,674, entity-chip 5,206, export-button 10,249 and tour 16,530. Their ceilings use the
same 2% whole-byte allowance; the smaller anchored components share native-aware stack and placement
logic. Tour's 4,023-byte excess over its previous ceiling is explicitly accepted as correctness
cost. Every already-passing ceiling remains unchanged, including combobox/select initial routes,
root/all entries, button, forms and the component P95/maximum canaries. The eight peer-inclusive
exclusion graphs remain passing; no dependency exclusion or measurement baseline was broadened.

The measured component census grows from 247 to 255 entries. The 95th-percentile boundary changes
from rag-answer at 111,927 gzip bytes to data-grid at 113,931 bytes; the eight new entries are all
below that boundary. Data-grid itself grows by 2,058 bytes with shared glass-surface/scroll-layer,
style-token and smaller grid/lifecycle changes. The reviewed P95 ceiling is 116,209 bytes. Passing
tighter ceilings remain unchanged, while stale standalone ceilings tighten, including button from
33 to 30 KiB, gauge to 23,585 bytes, flow-canvas to 51,806 bytes, and the pure shadcn definition to
2,038 bytes. Updated allowances use no more than 2% headroom; the existing 4% policy maximum,
entry inventory, exclusion checks and measurement method are unchanged.

`check:border-subtle` (blocking, in `contract-policy` next to `check:hit-area`) fails any literal
`--lr-color-border-subtle` or `--lr-theme-color-surface-border-subtle` in `src/components/forms/**`
or `src/internal/form-control.styles.ts`: that tier is decorative and may sit below the 3:1 a
control's boundary needs under WCAG 2.2 SC 1.4.11.

`check:hit-area` (WCAG 2.5.8 tappable-size floor) and `check:numeric-guards` (finite-number guards
on numeric properties) are now blocking parts of `contract-policy`; both currently pass with all
known exceptions explicit. Don't assume a check doesn't exist just because it is not listed here —
`ls packages/lyra-ui/scripts/check-*.mjs` is the real inventory. `pnpm run check:script-paths` guards
the inverse mistake (a `package.json` script naming a literal source path that no longer exists):
it exists because `test:platform` kept 21 hardcoded test paths across the 11-family restructure —
20 stopped resolving, `wtr` silently dropped them rather than erroring, and the Firefox/WebKit
matrix reported green while running one test file out of 21 for an extended period.

## Dev command reference

Run from repo root unless noted; package-local equivalents exist from `packages/lyra-ui/`
(plus `pnpm test:watch`).

```bash
pnpm install     # workspace install
pnpm build       # -r: per package -> dist/ (ESM + .d.ts). lyra-ui runs scripts/build.mjs:
                 #     tsc -p tsconfig.build.json (tsconfig.json with source maps OFF, since
                 #     package.json#files ships dist and not src), copies the CSS assets, then
                 #     check:build-artifacts fails on any .map or sourceMappingURL left in dist
pnpm test        # -r: builds lyra-ui first (its entrypoint tests import dist/), then runs wtr;
                 #     @aceshooting/lyra-flags has no test runner, just a plain Node script
pnpm lint        # -r: for lyra-ui NOT just a type check — the full contract-policy chain
                 #     + source tsc --noEmit + public compile contracts + strict test-tree tsc
pnpm manifest    # --filter @aceshooting/lyra-ui: cem analyze -> custom-elements.json
pnpm registrations # regenerate all.ts imports, tag aliases, allowlist, sideEffects, and explicit exports
pnpm plugin:sync # sync the lyra-ui version into both agent manifests + Claude marketplace entry
pnpm docs        # Storybook (.storybook/), demos every component live at localhost:6006
pnpm create:component --family utility --name status-panel # validated new-component scaffold
./scripts/test.sh # full Chromium+Firefox+WebKit test sweep (parallel lanes) + SSR/hydration/
                 #     visual/workspace tests -- run before publishing, NOT on every commit
pnpm release:prepare # consume changesets + regenerate version-derived artifacts (no commit/tag)
```

## `./package.sh` and the packaged references

`./package.sh` regenerates `packages/lyra-ui/llms/` itself before packaging — it never trusts that
directory to already be fresh. After a doc-affecting change, run `./package.sh` directly rather
than `pnpm run llms` followed by a separate `./package.sh` call: `pnpm lint`'s freshness checks
cover `llms/` but not the packaged copy under `plugins/`, so the second step going unrun is easy to
miss locally. CI catches it in the **`static-checks`** job, which runs `./package.sh` and then
`git diff --exit-code` over `plugins/lyra-ui/skills/lyra-ui/CHANGELOG.md`,
`plugins/lyra-ui/skills/lyra-ui/references/`, `skills/lyra-ui.skill` and
`skills/compose-lyra-interfaces.skill` — so it fails on the very next run, not days later, and not
in `docs-and-storybook`. `plugins/lyra-ui/skills/lyra-ui/references/` is GENERATED by
`./package.sh`, so hand-editing it breaks the build; `skills/*.skill` archives are produced by the
same script and CI checks their freshness by rerunning it and diffing the result.
`packages/lyra-ui/llms-full.txt` is the GENERATED concatenation of the authored `llms/<family>.md`,
the focused authored `llms/shared/*.md` guides (through the generated `llms/shared.md`
compatibility assembly), and `llms/00-*.md` sources (`pnpm run llms`). It remains a repository
archive rather than an npm package path; `package.sh` includes the focused shared routes in the
standalone reference tree as well as the compatibility route.

## CI topology at a glance

The gates expose six stable check families split along real data dependencies (`lint`,
`static-checks`, `build-and-coverage`, `packed-consumer`, `docs-and-storybook`,
`visual-regression`) rather than one linear job, so a red check names the specific phase to
reproduce instead of "build-test". The `lint` family derives the authoritative `contract-policy`
commands plus the three `lint` type-check suffixes and balances them across three hosted workers; a
fail-closed aggregate retains the stable check name. Local `pnpm lint` remains the complete
sequential command. `pnpm lint:parallel` runs the same authoritative three CI shards locally;
`CI_JOBS` caps its workers at three without omitting checks. Within `build-and-coverage`, four independently hosted coverage shards consume
the shared `dist/` artifact; a fail-closed merge job requires every raw coverage, JUnit, and
test-manifest artifact before it enforces whole-suite floors and reports to Codecov. Local
`test:coverage` deliberately retains the complete four-shard sequential run. A separate
`platform-contracts` matrix job runs the fast `test:platform` subset on Firefox and Safari
(WebKit), Chromium, Chrome, and Edge under Node 22.
`.github/workflows/full-engine.yml` runs the complete non-coverage suite in eight deterministic,
cost-balanced shards per browser on a weekly schedule and by manual dispatch.
`.github/workflows/test-all-browsers.yml` manually runs the same complete suite in Chromium,
Firefox, Chrome, Edge, and Safari (WebKit), with four independently hosted shards per browser. Five
lightweight browser-named aggregate jobs preserve the stable release checks. Releases require the
push CI, all five Test All Browsers aggregates, and all sixteen full-engine shards to succeed for
the exact main commit before any release tag is created. `scripts/test.sh` mirrors the full-engine
split through `TEST_SH_ENGINE_SHARDS` (default `1`), so a failing CI shard reproduces locally as
the identically-numbered shard.
