# CI, lint gates, and release plumbing — lyra-ui agent reference

> Detail behind the "Dev commands and gates" section of [AGENTS.md](../../AGENTS.md). The digest
> there is the contract; this file carries the full gate lists, ordering rationale, and incidents.

## `contract-policy` (most of `pnpm lint`'s time)

`pnpm lint` recurses through the workspace. For `@aceshooting/lyra-ui`, its exact expansion is
`pnpm run contract-policy && tsc --noEmit -p tsconfig.json && pnpm run test:types`.

The authoritative ordered `contract-policy` chain is
`packages/lyra-ui/package.json#scripts.contract-policy`; do not maintain a second command list in
prose. It covers script/package metadata, source/style/part/provenance policies, component and
migration coverage, manifest/framework/LLM freshness, component inventory and metadata,
autoloader/registration/side-effect architecture, form/event/cycle/interaction/token/numeric/
translation contracts, and every associated tooling self-test. When adding, removing, or moving a
gate, edit that package script first; `pnpm lint` and the CI `lint` job pick it up automatically.

**Toolchain constraint: `typescript@7` is the native Go port and exposes no JS compiler API.**
`ts.version` works, but `ts.SyntaxKind` and `ts.createProgram` are `undefined` — any tool that
imports `typescript` and drives the compiler API crashes on load (confirmed for `type-coverage`;
the same failure is certain for `typescript-eslint` type-aware rules, `ts-morph` codemods, and
`@stryker-mutator/typescript-checker`). When proposing a new lint/coverage tool here, reach for
TS-API-free options instead: `tsc`'s own strict flags, bespoke `check-*.mjs` AST-free scanners,
`secretlint`, `knip`, `cspell`. `tsc --noEmit` itself is unaffected — that's the native compiler
doing its own job, not a caller walking its AST.

`check:component-dependencies` (`scripts/check-component-dependencies.mjs`, with a colocated
`check-component-dependencies.test.mjs` chained beside it) is the newest member and the one whose
failure mode is least obvious. It parses every `<lr-*>` start tag out of each component's `html` /
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
`import '<dep>/<dep>.js'` line in the *registration entry*, never a registration side effect pulled
into a class module. The rare genuinely cycle-bound pair is suppressed in the registration entry
with `policy-allow(component-dependency: lr-menu): <reason>`; the reason is mandatory and a
suppression that no longer silences anything is itself reported, so the list cannot rot.

Two gates deliberately sit **outside** `contract-policy`, because both read artifacts that a static
lint run does not produce:

- `check:build-artifacts` (`scripts/check-build-artifacts.mjs`) is chained into `build` itself —
  `"build": "node scripts/build.mjs && node scripts/check-build-artifacts.mjs"` — so it runs at the
  only point where `dist/` is guaranteed present and current, which also covers `prepack` and
  therefore every published tarball. It fails on any `.map` file in `dist` and on any emitted file
  carrying a `sourceMappingURL` comment. See "`tsconfig.build.json` and dist hygiene" below.
- `check:coverage-floors` (`scripts/write-coverage-floors.mjs`) reads a finished coverage report;
  see "Coverage floors" below.

## CI: `.github/workflows/ci.yml` is authoritative

**`ci.yml` is the authoritative gate list and reproduction sequence.** Read it directly rather
than trusting a restated list, and reproduce a CI failure locally with the same commands in the
same order. The old single `build-test` job was one linear sequence; it's now six primary jobs split
along real data dependencies (verified against the actual scripts, not assumed) so independent
gates run in parallel instead of queueing behind each other. If a check goes red, the job name in
the PR checks list tells you which of these to reproduce locally:

1. **`lint`** — `pnpm install --frozen-lockfile`; `pnpm lint`. No Playwright and no build:
   `contract-policy` + `tsc --noEmit` + `test:types` are pure static analysis.
2. **`static-checks`** — everything needing neither a library build nor a docs build. Its inputs are
   already-committed files except for one read-only, content-addressed npm fetch. After `pnpm install
   --frozen-lockfile`, its exact command order is: the pure release-integrity, public-API and pinned-
   upstream helper tests; the networked `check:pinned-upstream-manifests`, which downloads the exact
   package versions without lifecycle scripts, validates both tarball and manifest digests, and runs
   the strict inventory comparison; `pnpm --filter
   '!@aceshooting/lyra-ui' -r test`; `pnpm run check:dead-code`; `pnpm run check:secrets`; `pnpm
   registrations` then a targeted diff of the generated `src/all.ts`, `src/ssr/all.ts`, root
   `src/components/lr-*.ts` aliases, root-registration allowlist, and `package.json`; `pnpm
   manifest` then a targeted diff of `custom-elements.json`; `pnpm --filter
   @aceshooting/lyra-ui run generate-editor-data` then a targeted diff of the two VS Code data
   files and `web-types.json`; `pnpm readme:check`; `./package.sh` then a targeted diff of the
   generated plugin references and both tracked skill archives; `pnpm skill:check`
   (tested Claude/Codex version synchronization plus plugin, marketplace, and repo-discovery
   consistency, not archive freshness); `pnpm
   storybook:check-theme`.

   `pnpm readme:check` covers two intentionally different files: root `README.md` (monorepo
   overview) and `packages/lyra-ui/README.md` (what npm actually renders on the registry page).
   Keep both READMEs' badge rows in sync by hand; don't add a second hand-maintained "N
   components" figure alongside the tag count — only a single count derived from
   `custom-elements.json` (e.g. "N custom elements") is self-verifying, a separately hand-bumped
   "components" number silently drifts every release.
3. **`build-and-coverage`** — this is still the critical gate, but it is now a split matrix of
   four dependent lanes plus a final aggregator:
   - `build_and_coverage_build` (`pnpm build`) uploads `packages/lyra-ui/dist/` as artifact.
   - `build_and_coverage_quality` (`pnpm --filter @aceshooting/lyra-ui check:component-quality:built`,
     `pnpm --filter @aceshooting/lyra-ui check:bundle-size`, `pnpm --filter
     @aceshooting/lyra-ui codecov:bundle`) consumes the shared dist.
   - `build_and_coverage_ssr` (`pnpm --filter @aceshooting/lyra-ui test:ssr`) consumes the shared
     dist.
   - `build_and_coverage_hydration` (`pnpm --filter @aceshooting/lyra-ui test:hydration`) consumes
     the shared dist.
   - `build_and_coverage_coverage` (`pnpm --filter @aceshooting/lyra-ui test:coverage`,
     `pnpm --filter @aceshooting/lyra-ui check:coverage-floors`, non-fatal Codecov uploads)
     consumes the shared dist.

   Coverage instrumentation still runs one browser file at a time for determinism on high-core hosts.
   This remains the coverage behavior that gates `check:coverage-floors`; only the scheduling changed to
   free the long path from unrelated dist-dependent work. This is the one time lyra-ui's own Chromium
   suite runs; a separate `pnpm test` would repeat the same files without coverage. `build_and_coverage_build`'s
   `pnpm build` step still runs `check:build-artifacts`, which is chained inside the package's
   `build` script.
4. **`packed-consumer`** — needs `dist/` (the tarball's `files` list includes it) but nothing
   else `build-and-coverage` needs, so it gets its own `pnpm build` rather than waiting on that
   job. It then runs `pnpm --filter @aceshooting/lyra-ui pack --dry-run`, verifies
   `dist/ssr-loader.js`, `custom-elements.json`, `llms.txt`, `llms-full.txt`, and the required
   `llms/` index/shared/tokens/peers/migration/component files, then runs `pnpm
   check:packed-consumer`, the packed-size budget, and the networked public-API semver gate.

   `packages/lyra-ui/tsconfig.json` sets `"stripInternal": true` — a declaration whose JSDoc
   carries `@internal` is erased from the emitted `.d.ts` even if a *public* property's type
   alias points at it (e.g. a type living in `src/internal/` but referenced by a public
   `@property`). `pnpm lint`/`build`/`test`/`manifest` all compile the source tree directly and
   stay green regardless; only this job compiles a real consumer against the packed tarball and
   surfaces `TS2305: has no exported member`. The tag also matches anywhere in the JSDoc block,
   including prose — a comment describing "deliberately not tagged internal" re-triggers the
   strip.
5. **`docs-and-storybook`** — `docs_build` (`docs:build` only needs the already-committed
   `custom-elements.json` via its internal `manifest:check`, not `dist/`, so it's independent of
   the two build jobs above) runs `pnpm docs:build` once (with `CODECOV_TOKEN`) and uploads
   `storybook-static/` as an artifact, the same "build once, fan out" shape
   `build_and_coverage_build`/`dist` already uses. `docs-and-storybook` itself and every
   `visual-regression` shard (point 6) both depend on `docs_build` and download that artifact
   instead of independently rebuilding Storybook from source — three fewer redundant rebuilds per
   run than the previous design. `docs-and-storybook`'s own steps (after installing Playwright and
   downloading the artifact) are: targeted sitemap diff; `pnpm docs:check`; `pnpm
   storybook:check`; `pnpm docs:check-show-code` (drives Chromium against the downloaded
   `storybook-static/`, hence still installing Playwright here too).
6. **`visual-regression`** — blocking as of the 2026-07-20 font-substitution determinism fix (see
   `packages/lyra-ui/visual-baselines/README.md`). The 253 axis-level captures are lexically sorted
   and round-robin partitioned across a three-leg matrix (85/84/84 captures), so the historical
   ~3.5min sweep no longer sits on one runner's critical path. Each leg installs Chromium,
   downloads the `storybook-static/` artifact `docs_build` (point 5) already built, runs
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
at most one; an ordinary unsharded local run still exercises all 253 captures.

A separate `platform-contracts` matrix job runs the platform contract suite (`test:platform`) for
Firefox, Chromium, Safari (WebKit), Chrome, and Edge on Node 20 and Node 22. Every leg sets
`npm_config_manage_package_manager_versions=false`, installs with `--frozen-lockfile`, restores a
`~/.cache/ms-playwright` cache keyed on browser + OS + `pnpm-lock.yaml` hash (system deps still
install unconditionally via `playwright install-deps`, since that's apt-level and the cache only
covers the downloaded browser binary), sets `WTR_BROWSER` and `WTR_STRICT_CONSOLE=1`, then runs
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
uses `package.json#packageManager` (`pnpm@11.18.0`). The package's supported engine remains `node
>=20`; this matrix uses 11 legs total (9 on Node 22, 2 on Node 20), well under the public-repo
20-job throughput limit, so `max-parallel` no longer needs to chase that cap.

## Scheduled full Firefox/WebKit suite

`.github/workflows/full-engine.yml` complements the fast pull-request matrix with the complete
non-coverage `src/**/*.test.ts` suite in Firefox and WebKit. It runs weekly and can also be started
with `workflow_dispatch`. Each browser is split into four deterministic round-robin shards under
Node 22. The runner discovers and lexically sorts the live test inventory, so every test file runs
exactly once across the four shards without maintaining a second allowlist.

Every shard builds first because `package-entrypoints.test.ts` imports the package's built `dist/`
targets. The package's `pretest` lifecycle provides the same build-first guarantee for a clean
`pnpm test`. Each shard then runs with strict browser-console handling. The smaller `test:platform`
matrix in `ci.yml` remains the blocking Node 20/22 pull-request contract and does not substitute
for this complete sweep; releases require a manual-dispatch run from `main` with all eight shards
successful for the exact release commit before any tag is created.

To reproduce one shard locally after installing the requested Playwright browser:

```bash
WTR_BROWSER=firefox WTR_STRICT_CONSOLE=1 \
  WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=4 \
  pnpm --filter @aceshooting/lyra-ui test:full-engine-shard
```

Run `pnpm build` first when the selected shard includes package-entrypoint tests. The deterministic
discovery and sharding logic is covered by the package's blocking `test:tooling` suite.

## Local aggregate: `scripts/ci.sh`

`./scripts/ci.sh` consolidates the six primary jobs into one Node 22/Chromium run. It requires the
active Node major to be 22 and pnpm to match `package.json#packageManager`; this prevents a green
run under a newer local Node from being mistaken for the CI environment. It intentionally reuses
one install, one library build, and one Storybook build where independent CI jobs repeat them.
It also omits external Codecov/upload-artifact reporting actions; the blocking local equivalents
(`check:bundle-size`, coverage, and visual regression) still run. `codecov:bundle` is reporting
only and does not replace the blocking bundle-size gate. The aggregate includes the static job's
networked, content-addressed pinned-upstream-manifest check; an unavailable registry or changed
artifact fails the run instead of silently falling back to a clone-generated manifest.

- `./scripts/ci.sh --platform` adds Firefox and WebKit `test:platform` runs under the active Node
  22/pnpm 11 toolchain. It is useful for browser-engine coverage but is not the two-Node CI matrix.
- `./scripts/ci.sh --platform-matrix` (or `--all`) runs the primary aggregate and then all four
  Node 20/22 × Firefox/WebKit legs. Node 20 needs pnpm 10.34.5; Node 22 needs pnpm 11.18.0. The
  `CI_SH_NODE20_BIN`, `CI_SH_NODE22_BIN`, `CI_SH_PNPM20_BIN`, and `CI_SH_PNPM22_BIN` overrides
  accept explicit executable paths. NVM installations are discovered by major version, with the
  newest installed patch selected by version order.
- `CI_SH_SKIP_INSTALL=1` skips only the primary dependency installation and Chromium download;
  platform modes still install their own dependencies and requested Playwright engines.
- `--keep-going` aggregates only generated-artifact freshness failures. Real lint, build, test,
  docs, visual, packed-consumer, and platform failures remain fail-fast.

## Full local test sweep: `scripts/test.sh`

`./scripts/test.sh` runs the complete `src/**/*.test.ts` suite (453 files, not the curated
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
`test:coverage` -> `check:coverage-floors`, matching `build-and-coverage`'s order); a shared
`pnpm build` runs once up front since every lane needs `dist/` for `package-entrypoints.test.ts`.
Each lane's output is captured to its own log file (path printed at start) so concurrent runs don't
interleave on the terminal; a failing lane's log is printed in full at the end.

The `firefox`/`webkit` lanes run `test:full-engine-shard` with `WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=1`
-- the shard math in `scripts/full-engine-shard.mjs` assigns every discovered file to shard 1 of 1,
so this is the complete suite in one process, not an actual shard. `test:platform`'s 26-file subset
is a strict subset of this run, so it is not run separately here.

Because it's heavy (three full browser-engine sweeps), it is meant to run before publishing a
release, not on every commit -- see [AGENTS.md](../../AGENTS.md)'s "Dev commands and gates" section
and `.claude/commands/publish.md` step 2.

## Release integrity

`scripts/publish.sh` is self-contained in this repository. It does not read or run a sibling
website checkout; website synchronization is a separate, opt-in post-release operation. It refuses
to start from a dirty tree, requires one canonical fetch URL and one canonical push URL, and keeps
the maintainer GitHub token out of dependency and package lifecycle processes. Changesets may
auto-expand the release to publishable dependents; every actual package-version delta is therefore
generated, tested, reviewed, packed, tagged, and released. Only stable core `major.minor.patch`
versions are accepted.

After regenerating package metadata → manifest → component metadata → manifest, it runs lint →
build → test and every prepack generator. It updates the narrowly anchored README source-version
line (which deliberately makes no pre-publish registry claim). For a lyra-ui release it also
synchronizes the Claude and Codex plugin manifests plus the version-bearing Claude marketplace
entry, regenerates the plugin references and standalone skill archives, and verifies the complete
plugin contract. It then shows the complete clean-start worktree and diff stat before confirmation.
Packing reruns the same deterministic lifecycle. The script stages the full version-derived CEM,
inventory, editor, framework, token, LLM, and plugin set; any other unstaged tracked output aborts
for review. A flags-only release does not touch the lyra-ui plugin.

The release commit is pushed alone to `origin/main`, which starts CI. The script dispatches
`full-engine.yml` from `main`, requires an exact-SHA `push`/`main` CI run and an exact-SHA
`workflow_dispatch`/`main` full-engine run, and creates no tag if either fails. Only after both
qualify does it create annotated tags, push the multi-package tag set atomically, and create the
GitHub Releases that trigger `publish.yml`. Recovery output is phase-aware and never suggests a
release after failed qualification.

The read-only publish verification job rejects a lightweight tag, verifies the annotated tag's
peeled commit is both the exact checkout and the workflow invocation ref/SHA, then waits for one
successful `push`/`main` `ci.yml` run and one successful `workflow_dispatch`/`main`
`full-engine.yml` run whose `head_sha` is that commit. A manual invocation must therefore be
dispatched on the tag itself (for example, `gh workflow run publish.yml --ref <tag> -f tag=<tag>`),
not on the default branch. The CI run must contain
successful results for the six primary jobs and all four Firefox/WebKit × Node 20/22 platform legs,
and every job present in that
CI run must succeed so a future gate cannot be added without becoming release-blocking. The
full-engine run must contain all four Firefox and all four WebKit shards, with every job successful.
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

The manual `sign-release.yml` recovery path uses the same read-only rebuild/byte-verification job,
14-day artifact handoff, protected minimal signer, post-approval tag check, and release-asset
round-trip. Dispatch it on the requested tag, never on `main`.

Component release history checks require a non-shallow clone with tags; the CI lint checkout uses
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

Three release-integrity quirks worth knowing before trusting a release round's mechanics, none yet
fixed at the source:

- `scripts/publish.sh`'s changeset-package parser (`changeset_packages()`) only matches
  double-quoted frontmatter (`^"@aceshooting/lyra-ui": (major|minor|patch)$`) — a single-quoted
  package name is valid YAML and `pnpm changeset status` parses it fine, but the script concludes
  there are no pending changesets for any publishable package and bails. Recurred multiple times;
  always double-quote package names in `.changeset/*.md` frontmatter (matches what the `changeset`
  CLI itself emits).
- `.changeset/config.json`'s `"updateInternalDependencies": "patch"` only governs regular
  `dependencies`/`devDependencies`. `@aceshooting/lyra-ui`'s `peerDependency` on
  `@aceshooting/lyra-flags` (`workspace:^x.y.z`) escalates to a **major** bump the moment that
  peer's own version changes in the same `pnpm changeset version` run, regardless of what severity
  the pending changesets actually declare for lyra-ui. Only fires when lyra-flags' own version
  changes in that round; an all-lyra-ui round bumps cleanly.
- The per-package generation loop (package-metadata → manifest → component-metadata → manifest →
  lint → build → test → default-string-slices → framework-types → design-tokens → editor-data →
  llms) never regenerates `docs/component-integration.md`/
  `scripts/fixtures/component-integration.json`, but every version bump shifts every component's
  *built* gzip size regardless (the regenerated `package-metadata.ts`, embedding the new version
  plus release history, is imported by the shared base every component bundles) — so CI's
  `build-and-coverage / quality` job (`check:component-quality:built`) reliably fails on the pushed
  release commit. Fix: rebuild, `node scripts/generate-component-quality.mjs --write
  --measure-gzip`, `check:bundle-size`, then a follow-up commit on top of the already-pushed release
  commit, re-qualified through `wait-ci`/`wait-full-engine` like any other commit before tagging.

## Coverage floors (`scripts/coverage-floors.json`)

`web-test-runner.config.js` reads its blocking per-metric thresholds from
`packages/lyra-ui/scripts/coverage-floors.json` rather than from literals in the runner config. The
file is generated: `node scripts/write-coverage-floors.mjs --write-floors` (from `packages/lyra-ui`,
after a `test:coverage` run has written `coverage/`) sets each metric to
`floor(measured − margin)`, default margin 1.5 points, and records the measurement and date it used
alongside the floors.

- `pnpm --filter @aceshooting/lyra-ui check:coverage-floors` is the non-mutating mode, and runs in
  CI immediately after `test:coverage`. It fails both ways: a floor **above** the measurement (the
  suite cannot pass) and a floor more than 5 points **below** it (the floor stopped gating
  anything).
- `--write-floors` never lowers a floor without `--allow-lower`, so a coverage regression is an
  explicit line in the diff rather than a silent re-baseline by whoever last ran the command.
- Why generated at all: the hand-edited floors had drifted to statements 75 / branches 65 /
  functions 65 / lines 75 while the suite was measuring 99 / 94 / 99 / 99 — roughly a quarter of the
  source tree could have gone uncovered without the gate firing. A floor is only a gate while it
  sits just under the measurement, and it only stays there if refreshing it is one mechanical
  command producing a reviewable diff.
- **The mirror-image failure is a threshold set *tighter* than measurement from day one** — an
  "aspirational" budget that's red the moment it lands, which trains everyone to ignore that gate
  entirely rather than fix it. This has recurred independently in the package-size budget
  (`check:package-size`'s minimum-reduction figure) and the qualification axe scanner's evidence
  requirements — both are now measurement-derived, matching the floors approach above. Any new
  budget/threshold should start from a measured baseline, not a target number picked in advance.
- It prefers `coverage/coverage-summary.json` (exact statement totals) and falls back to
  `coverage/lcov.info`, which carries no statement records — in that mode the statements figure
  reuses the line figure, and the script says so.

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
which leaves consumers' devtools chasing a 404).

## `prepack` and editor data

**`prepack`** (`package-metadata` → `default-string-slices` → `manifest` → `framework-types` →
`design-tokens` → `build` → `generate-editor-data` → `llms`; `packages/lyra-ui/package.json`)
determines tarball contents on `npm pack`/`npm publish`, run by npm itself rather than as one
monolithic CI command. Starting with `package-metadata` prevents a version bump from packing stale
runtime version constants. `generate-editor-data` regenerates
`vscode-html-data.json`, `vscode-css-data.json`, and `web-types.json` from
`custom-elements.json`.

The generated public-surface outputs are CI-gated across the lint and static jobs. The
`static-checks` job runs `pnpm manifest` →
`git diff --exit-code -- packages/lyra-ui/custom-elements.json` →
`pnpm --filter @aceshooting/lyra-ui run generate-editor-data` →
`git diff --exit-code -- packages/lyra-ui/vscode-html-data.json packages/lyra-ui/vscode-css-data.json packages/lyra-ui/web-types.json`
(`.github/workflows/ci.yml`, and that file remains the authority). Note the ordering dependency:
the editor data is derived *from* `custom-elements.json`, so a stale manifest reddens the first
`git diff` and the editor-data regeneration then runs against the fixed manifest. Framework type
and LLM freshness are enforced inside `pnpm lint`. Locally, regenerate in dependency order and
commit the complete set whenever you touch the public surface (JSDoc, attributes, parts, or CSS
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
  Budgets are reviewed release policy and are never loosened by a generator.
- `pnpm test:visual` runs the visual-regression screenshot suite against `visual-baselines/`.

`check:hit-area` (WCAG 2.5.8 tappable-size floor) and `check:numeric-guards` (finite-number guards
on numeric properties) are now blocking parts of `contract-policy`; both currently pass with all
known exceptions explicit. Don't assume a check doesn't exist just because it is not listed here —
`ls packages/lyra-ui/scripts/check-*.mjs` is the real inventory. `pnpm run check:script-paths` guards
the inverse mistake (a `package.json` script naming a literal source path that no longer exists):
it exists because `test:platform` kept 21 hardcoded test paths across the 11-family restructure —
20 stopped resolving, `wtr` silently dropped them rather than erroring, and the Firefox/WebKit
matrix reported green while running one test file out of 21 for an extended period.
