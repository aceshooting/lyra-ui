# CI, lint gates, and release plumbing — lyra-ui agent reference

> Detail behind the "Dev commands and gates" section of [AGENTS.md](../../AGENTS.md). The digest
> there is the contract; this file carries gate lists, ordering rationale and the release procedure.
> Where a script, workflow or JSON file is the authority, this file points at it instead of copying
> its contents; read the source for exact commands, order and numbers.

## `contract-policy` (most of `pnpm lint`'s time)

`pnpm lint` recurses through the workspace. For `@aceshooting/lyra-ui` it expands to
`pnpm run contract-policy && tsc --noEmit -p tsconfig.json && pnpm run test:types && pnpm run
check:test-types`. The ordered chain is `packages/lyra-ui/package.json#scripts.contract-policy`;
keep no second command list in prose. When adding, removing or moving a gate, edit that script
first: local `pnpm lint` and the CI lint sharder both derive their inventory from it.
`ls packages/lyra-ui/scripts/check-*.mjs` is the real inventory of checks.

**Toolchain constraint.** The pinned `typescript@7` root export lacks the legacy compiler API
(`ts.SyntaxKind` and `ts.createProgram` are `undefined`). The declaration-link checker uses the
explicitly unstable `typescript/unstable/sync`, `/fs` and `/ast` interfaces for that one narrow
check; this does not establish compatibility for `type-coverage`, type-aware `typescript-eslint`,
`ts-morph`, Stryker's TypeScript checker or other compiler-API tools. Verify a proposed tool against
the pinned package first, or use options needing no compiler API: `tsc`'s strict flags, bespoke
`check-*.mjs` scanners, `secretlint`, `knip`, `cspell`.

Two silent-failure checks worth knowing:

- `check:component-dependencies` parses every `<lr-*>` start tag in each component's templates
  (including `unsafeStatic(tag('x'))`) and proves each resolves to a registration reachable from
  that component's own registration entry (static, re-export and lazy `import()` alike). The
  class/registration split that makes the package tree-shakeable otherwise lets a class render a
  child nobody registers, an inert element under granular imports that any all-registrations barrel
  hides. Fix with an `import '<dep>/<dep>.js'` in the _registration entry_, never a side effect in a
  class module. A genuine cycle-bound pair is suppressed there with
  `policy-allow(component-dependency: lr-menu): <reason>`; the reason is mandatory and a suppression
  that silences nothing is itself reported.
- `check:composed-child-contracts` validates static attributes and `.property`/`?attribute`
  bindings in component and Storybook templates (parsed with `oxc-parser`) against
  `custom-elements.json`, following CEM superclass/mixin declarations and the effective
  `DocumentAnchorTarget` surface. It fails closed if it scans zero templates, tags or bindings; its
  self-test uses isolated temporary packages and never rewrites the workspace manifest.

Gates deliberately **outside** `contract-policy` because they read artifacts a static lint does not
produce:

- `check:build-artifacts` is chained into `build` itself, so it runs where `dist/` is present and
  current (and therefore in `prepack` and every tarball). It fails on any `.map` under `dist` or any
  emitted file with a `sourceMappingURL` comment, then runs `scripts/ai-compile-contract.test.mjs`
  (compile-only AI assertions must have no source, emitted module, subpath or tarball entry).
- `check:coverage-floors` reads a finished coverage report ([Coverage floors](#coverage-floors-scriptscoverage-floorsjson)).

## `pnpm regen`: the single regeneration command

`contract-policy` pairs a committed artifact with a freshness gate many times over (manifest,
framework types, events, testing event registry, component metadata and inventory, tag aliases,
registration artifacts, autoloader manifest, default-string and translation slices, palettes, design
tokens, reservation styles...). **`pnpm run regen`** (`packages/lyra-ui/package.json#scripts.regen`)
chains every generator's own named script in dependency order; read that script for the order, and
never re-spell it as `node scripts/...` paths or copy it into prose.

Two steps are deliberately **not** in `regen` and run afterwards, in this order:

1. **`pnpm build`, then `component-quality`** (`generate-component-quality.mjs --write
   --measure-gzip`). It measures the _built_ `dist/` gzip size and reads `src/**/*.test.ts` for
   test-quality scoring, so it needs a fresh build and must run **last**, after every generator
   that writes into `src/` (for example `default-string-slices` rewrites class files).
2. **`./package.sh`.** It regenerates `packages/lyra-ui/llms/` itself, then repackages
   `plugins/lyra-ui/skills/lyra-ui/references/` and the `skills/*.skill` archives. CI's
   `static-checks` diffs them.

Rules that follow from `component-quality`'s inputs:

- Any change under `src/`, test-only edits included, owes a rebuild and a regeneration of
  `component-quality` before commit. A byte-identical `pnpm manifest` is no evidence that it is
  clean; CI's `lint` reports `component-qualification.json: stale or missing` otherwise.
- The gzip bytes are Node-patch-sensitive (Node's bundled zlib differs between patches).
  Regenerate under the exact `.nvmrc` patch (`nvm use`); a remote build box usually has a different
  one.

`scripts/check-regen-coverage.mjs` (with `check-regen-coverage.test.mjs`, both in `contract-policy`)
keeps `regen` from falling behind. It derives the required generators from the gates themselves (a
same-file `--check`/write argument pair, a gate's backtick-quoted `pnpm run <name>` remedy text, or
a gate importing/naming a generator file) and requires each to be reachable from `regen` or to
carry a one-line reasoned entry in its `EXEMPTIONS` map; an exemption without a reason fails the
gate. Read `EXEMPTIONS` for the current list and reasons.

### Hosted preparation (`prepare-artifacts.yml`)

- **Reviewed source-contract enrollment.** The optional `sourceContracts` JSON input (source mode
  only) has `schemaVersion: 1` and any of: `updates` (`{ module, exportName, kind,
  expectedFingerprint }`: an existing documented owner and its exact old census fingerprint),
  `enrollments` (`{ module, exportName, kind, document, family, locator }`: a new public contract and
  its authored locator) and `relocations` (`{ module, toModule, exportName, kind,
  expectedFingerprint }`, moving a declaration into a shared module while keeping its public
  re-exports). At least one owner is required, and the authored documentation is committed and
  reviewed first. After canonical regeneration the updater derives fingerprints and routes with the
  existing scanner, preserves existing routes and locators, and rejects legacy owners, stale
  preimages, unchanged requests and unrelated drift; the complete census and the authored docs must
  pass their gap checks before the fixture is written. Review the before/after owner log; this is
  not a blanket rebaseline.
- An update may add `additionalRoutes` (unique canonical `src/**/*.ts` paths): the live routes must
  equal the existing routes plus exactly those, still with the exact old fingerprint. Without it an
  update must change the fingerprint and keep the routes. A relocation keeps fingerprint and routes
  unless it pins `expectedTargetFingerprint` (dependency ownership participates in the fingerprint,
  so a pure move can change it); the old preimage and target hash must both match and differ.
  Neither enrollments nor relocations accept `additionalRoutes`; source and target owners cannot
  overlap another operation.
- **Hosted dependency refresh.** `mode=source` with `upgradeDependencies=true` (publication and
  source-contract inputs empty) runs `VERIFY=0 ./scripts/upgrade.sh` and then the complete
  canonical regeneration, build, measurements and source checks, under the exact Node and package
  manager. Review the artifact's manifest, lockfile, current-peer profile and derived changes and
  commit the verified update before dispatching release preparation. No refs are pushed.
- In release mode the workflow keeps its detached checkout and creates a local `main` ref at the
  dispatch SHA for Changesets' base branch (a mismatched existing `main` is rejected); it does not
  filter pending changesets or replace release preparation's `origin/main` ancestry check.

### Composable styling and the token grammar

Author theme inputs in `tokens/canonical-tokens.json`, looks in `tokens/looks/*.json`, density in
`tokens/density.json` and glass in `tokens/surfaces/glass.json`. `pnpm run style-axes` generates the
production theme, optional look/surface/density/accent stylesheets, runtime look definitions and the
style model embedded in `theme.ts`; `check:style-axes` fails when any projection is stale. Edit the
sources and regenerate; never hand-edit outputs. The runtime API is
`setLyraStyle()`/`getLyraStyle()`/`resetLyraStyle()` plus `defineLyraLook()`; there is no theme-preset
generator or facade.

The token grammar has one source, `scripts/fixtures/theme-token-grammar.json`: `theme.ts` carries two
literal copies (runtime and self-contained bootstrap) and `scripts/theme-token-grammar.mjs` builds
the generator validator from the fixture. `scripts/theme-token-grammar.test.mjs` (in `test:tooling`)
fails when either copy or the mode-default reference colours drift. The bootstrap's shipped bytes
have their own ceiling, `scripts/theme-bootstrap-budget.json`, enforced by `check:theme-bootstrap`
(chained into `build`) with an inline-script safety check (`</`, `<!--`, `<script`, raw
U+2028/U+2029). It is not in `bundle-budgets.json` (that script re-minifies); raising it needs a
reviewed re-measurement.

## CI: `.github/workflows/ci.yml` is authoritative

`ci.yml` is the authoritative gate list and reproduction sequence: read it, and reproduce a CI
failure locally with the same commands in the same order. Six primary check families are split along
real data dependencies, so a red check names the phase to reproduce:

1. **`lint`** runs `pnpm --filter @aceshooting/lyra-ui run lint:parallel`: a deterministic weighted
   partition of the `contract-policy` commands plus the three type-check suffixes into three
   concurrent lanes on one runner, read directly from `package.json`. Occurrence ordinals keep the
   split disjoint and exhaustive, per-command costs in `scripts/fixtures/lint-command-costs.json`
   weight it (a new command gets unit cost), and each lane keeps original policy order. The job uses
   a full-history checkout because the component-metadata gate reads tags. Remeasure costs from the
   `lint-timing` artifact with `node packages/lyra-ui/scripts/ci-costs.mjs lint <lint-timing.jsonl>`.
   Local `pnpm lint` stays complete and sequential; `pnpm lint:parallel` runs CI's partition
   (`CI_JOBS` caps workers at three without omitting checks). No lane needs Playwright or a build.
2. **`static-checks`** needs neither a library build nor a docs build: workflow syntax, the generated
   release-qualification manifest, release-integrity, public-API, pinned-upstream, other-package,
   dead-code and secret checks, then regenerate-and-diff of registrations, the manifest, editor data,
   README status, plugin references, skill archives and Storybook theme contracts. Copy the failing
   job's steps from `ci.yml`. `pnpm readme:check` covers root `README.md` and
   `packages/lyra-ui/README.md` (the npm page); keep their badge rows in sync by hand and state only
   a count derived from `custom-elements.json` ("N custom elements"), never a second hand-bumped
   "components" number.
3. **`build-and-coverage`** shares one build and fans out: `build_and_coverage_build` (`pnpm build`)
   uploads `dist/`; `_quality` (`check:component-quality:built`, `check:bundle-size`,
   `codecov:bundle`), `_ssr` (`test:ssr`) and `_hydration` (`test:hydration`) consume it;
   `_coverage_shard` is a four-leg matrix, each worker running
   `node scripts/coverage-shard-runner.mjs --shard N` in the pinned Playwright image and uploading one
   `coverage/shards/coverage-shard-N` artifact (`if-no-files-found: error`); `_coverage` runs with
   `always()`, merges (`--merge`), enforces `check:coverage-floors` on the merged report, and does the
   non-fatal Codecov uploads. The runner refuses a missing `coverage-final.json`, `junit.xml` or
   `test-files.json` and proves the four test manifests are disjoint, exhaustive and the
   deterministic partition of the inventory; the job separately rejects any non-success shard.
   Each worker runs one browser file at a time (determinism); only workers run concurrently, and four
   is the useful split (finer shards add a runner bootstrap each). Local
   `pnpm --filter @aceshooting/lyra-ui test:coverage` stays complete and sequential (all four shards,
   merge, cleanup); `scripts/ci.sh` and `scripts/test.sh` use that default. This is the one run of
   lyra-ui's own Chromium suite in push CI. Browser lanes use the Playwright image pinned in the
   workflow.
4. **`packed-consumer`** aggregates independent phases. The contract lane checks checksum-verified
   tarballs (lyra-ui from the ATTW package producer, the companion packages from the
   companion-packages job) and never builds or packs; it verifies required files, then the packed
   install/import/declaration/bundle/framework contract and packed-size budget, skipping only ATTW.
   ATTW export entries (from the current exports map, excluding CSS and the classic-script bootstrap)
   are sorted and round-robin partitioned across four jobs. One producer runs real `pnpm pack`,
   verifies tracked-source freshness and the archive's size and contents against the budgets, and
   uploads the tarball with its SHA-256; every worker verifies those bytes and the packed name,
   version and ordered exports before choosing its partition. The public-API lane consumes the shared
   dist and runs the networked semver gate. Locally `pnpm check:packed-consumer` is complete and
   unsharded; `pnpm check:packed-consumer:contracts` is the CI-only path that skips ATTW.

   `packages/lyra-ui/tsconfig.json` sets `"stripInternal": true`: a declaration whose JSDoc carries
   `@internal` (anywhere in the block, prose included) is erased from the emitted `.d.ts` even when a
   public property's type alias points at it. Lint, build, test and manifest compile the source tree
   and stay green; only this job compiles a real consumer against the tarball and surfaces
   `TS2305: has no exported member`.
5. **`docs-and-storybook`**: `docs_build` runs `pnpm docs:build` once (it needs only the committed
   `custom-elements.json`, not `dist/`), verifies the generated sitemap is fresh and uploads
   `storybook-static/`. The Storybook contract crawl and the Show Code crawl run in parallel against
   that artifact, and the stable `docs-and-storybook` aggregate requires both.
6. **`visual-regression`** is blocking (baselines and determinism notes:
   `packages/lyra-ui/visual-baselines/README.md`). Stories expand to axis-level captures, some
   compared with tracked baselines and some evidence-only, lexically sorted and round-robin
   partitioned across a three-leg matrix; each leg downloads the `docs_build` artifact, runs
   `test:visual`, and uploads a uniquely named diff artifact. A `visual-regression` aggregate keeps the
   stable branch-protection name.

   ```bash
   VISUAL_SHARD_INDEX=1 VISUAL_SHARD_TOTAL=3 pnpm --filter @aceshooting/lyra-ui test:visual
   ```

   Sharding is applied after an optional `--filter`, at capture granularity; an unsharded local run
   exercises every capture.

A separate `platform-contracts` matrix runs the curated `test:platform` subset in six Node 22 legs:
Firefox in two shards, and Chromium, Chrome, Edge and Safari (WebKit) in one each. Four legs use the
pinned Playwright image; branded Chrome and Edge use the runner VM with bounded browser setup. Every
leg installs with `--frozen-lockfile` and enables strict browser console checking. The packed-consumer
jobs cover the Node floor, declarations, tree shaking and framework recipes without repeating that
matrix per browser. Node 22 uses `package.json#packageManager` (`pnpm@12.10.1`).

## Scheduled full Firefox/WebKit suite

`.github/workflows/full-engine.yml` runs the complete non-coverage `src/**/*.test.ts` suite in
Firefox and WebKit weekly and on `workflow_dispatch`, each browser in eight cost-balanced shards
under Node 22. The runner discovers and lexically sorts the live inventory, so every file runs
exactly once without a second allowlist. Unknown files have unit cost; the package-entrypoint
contract has a higher source-controlled cost; greedy least-cost assignment keeps it from dominating
one shard. Every shard builds first (`package-entrypoints.test.ts` imports `dist/`; the package's
`pretest` gives a clean `pnpm test` the same guarantee) and runs with strict browser-console handling.

Scale with *more shards*, not more concurrency per shard: raising a lane's `WTR_CONCURRENCY` from 4
to 10 broke hover assertions in `lr-span-waterfall` and `lr-test-results`, because pointer and paint
timing degrade under CPU contention regardless of core count. (The coarser `platform-contracts`
matrix is the opposite trade: its small subset loses to per-job overhead when split finer.)

`test:platform` remains the blocking pull-request contract and does not substitute for this sweep.
Releases require a manual-dispatch run from `main` with every shard for both browsers successful on
the exact release commit. Reproduce one shard locally (run `pnpm build` first when it includes
package-entrypoint tests; sharding logic is covered by `test:tooling`):

```bash
WTR_BROWSER=firefox WTR_STRICT_CONSOLE=1 \
  WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=8 \
  pnpm --filter @aceshooting/lyra-ui test:full-engine-shard
```

## Manually dispatched browser suite

`.github/workflows/test-all-browsers.yml` runs the complete non-coverage suite in Chromium, Chrome and
Edge by default (its `browsers` input also accepts Firefox and Safari, whose complete suites are
release-required through `full-engine.yml` instead). One shared build feeds four deterministic shards
per browser on independent runners through `scripts/test_all_browsers.sh`; browser-named aggregate
jobs keep the release check names stable and the worker names expose the failed shard. Subset runs
are for diagnosis only: the generated qualification manifest requires the Chromium, Chrome and Edge
aggregates from one successful `workflow_dispatch` run whose `head_branch` is `main` and whose
`head_sha` is the release commit, so a subset run cannot qualify a release.

## Local aggregate: `scripts/ci.sh`

`./scripts/ci.sh` consolidates the six primary jobs into one Node 22/Chromium run. It requires the exact `22.23.2` patch recorded in `.nvmrc` and pnpm to match `package.json#packageManager`, so a green run under another patch is not mistaken for CI; run `nvm use` first. It reuses one install, one library build and one Storybook build, and omits the external Codecov and artifact-upload actions (the blocking local equivalents of bundle-size, coverage and visual regression still run; `codecov:bundle` is reporting only). It includes the networked, content-addressed pinned-upstream-manifest check (an unavailable registry or changed artifact fails the run rather than falling back to a clone-generated manifest) and the checksum-pinned actionlint workflow gate.

- `./scripts/ci.sh --platform` adds the unsharded `test:platform` browser sweep under the active
  Node 22/pnpm 12 toolchain. The 5-browser Node 22 sweep is Firefox, Chromium, Chrome, Edge, and
  Safari. It covers every installed browser in an unsharded run.
- Firefox runs one test page per browser process whatever `WTR_CONCURRENCY` requests, because its
  native pointer capture crosses browser contexts and concurrent page gestures release or intercept
  each other's input; process shards keep parallelism. With no explicit concurrency, Chromium keeps
  its automatic default and WebKit/Safari use the smaller of four pages or half the CPUs. The
  aggregate runner budgets shard pages from Firefox's one-page and WebKit's four-page allocations.
- `./scripts/ci.sh --platform-matrix` (or `--all`) runs the primary aggregate and the same six
  Node 22 browser/shard legs as CI. Node 22 needs pnpm 12.10.1.
  Its 6 legs are source-derived: Node 22 runs Chromium (1 shard), Chrome (1 shard), Edge (1 shard), Firefox (2 shards), and Safari (1 shard).
  `CI_SH_NODE22_BIN` and `CI_SH_PNPM22_BIN` accept explicit executable paths; the selected Node
  must match the exact `.nvmrc` patch (`22.23.2`).
- `CI_SH_SKIP_INSTALL=1` skips only the primary dependency installation and Chromium download;
  platform modes still install their own dependencies and requested engines.
- `--keep-going` aggregates only generated-artifact freshness failures; real lint, build, test,
  docs, visual, packed-consumer and platform failures stay fail-fast.
- `ci.sh` is Chromium-only and cannot see a contract absent on another engine; see
  [testing.md](testing.md#pointer-driven-state) for when a `WTR_BROWSER=firefox|webkit` run is required.

## Full local test sweep: `scripts/test.sh`

`./scripts/test.sh` runs the complete discovered suite (not the `test:platform` subset, which is a
strict subset of it) on Chromium, Firefox and WebKit, plus SSR/hydration, visual regression and the
other workspace packages' tests, i.e. what `full-engine.yml` covers weekly. It excludes
`ci.sh`'s lint, artifact-freshness, docs-freshness and packed-consumer gates: `ci.sh` is the
per-commit equivalent, `test.sh` the pre-publish cross-browser sweep (not per commit).

Five lanes (`chromium`, `firefox`, `webkit`, `visual`, `workspace`) run as parallel background
processes after one shared `pnpm build`; `--serial` runs them one at a time. Lane steps keep their
order (the `chromium` lane is `check:component-quality:built` -> `test:ssr` -> `test:hydration` ->
`test:coverage` -> `check:coverage-floors`). Each lane logs to its own file (path printed at start)
and a failing lane's log is printed in full at the end.

The `firefox`/`webkit` lanes run `test:full-engine-shard` with `WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=1`
(the complete suite in one process). `TEST_SH_ENGINE_SHARDS=<n>` splits each engine into `n` shard
lanes, mirroring `full-engine.yml`, so a failing CI shard reproduces as the same-numbered local one;
raising `WTR_LANE_CONCURRENCY` instead reintroduces the hover/paint flakiness above. **Shards
multiply here and divide in CI:** locally every shard is another process on the same host, so the
page count is `shards x (Firefox pages + WebKit pages)`. The script budgets about half the host's
CPUs as browser pages and clamps an over-large request with a warning rather than failing.

## Release integrity

Releases run in four steps; nothing is tagged or published from a workstation.

**Before every release**, run `./scripts/upgrade.sh` with the exact `.nvmrc` Node patch (an
author-run upgrade for this release satisfies this: wait for it, then review its output rather than
running a duplicate or concurrent one). Dependencies in the root and every workspace package go to
their latest stable versions, including the latest tested optional peers. Review manifest, lockfile,
compatibility-profile and generated changes, fix compatibility failures and commit that update before
preparing the version. Keep supported consumer peer ranges unless a reviewed, semver-appropriate
change is needed (testing the latest peer does not justify dropping an older supported one); if a
latest version cannot be supported, document the concrete blocker. Any dependency change after
qualification needs a new commit and fresh qualification, and an existing tag is never rewritten.

**First package publication.** Use the normal changeset flow (including any dependent bump), then
verify packed exports and dependencies against the versions actually on npm; workspace source at a
matching version is no evidence a registry dependency works. npm needs a package to exist before its
trusted publisher can be configured, so for the first publication of `@aceshooting/lyra-docs`,
`@aceshooting/lyra-ide` or `@aceshooting/lyra-translations`, provide a short-lived granular npm token
(`@aceshooting` read/write direct publish, Bypass 2FA) as the `NPM_BOOTSTRAP_TOKEN` secret in the
protected `npm-publish` environment and dispatch
`gh workflow run release.yml --ref main -f package=<lyra-docs|lyra-ide|lyra-translations> -f first_package_bootstrap=true`.
Both workflows reject the flag for other packages, for a package already on the registry, and on an
ambiguous registry response. After environment approval the protected job uses the token only for the
verified tarball and publishes with provenance. Then configure the trusted publisher for
`.github/workflows/publish.yml` and the `npm-publish` environment and remove the secret; later
releases use OIDC without the flag. Exact-commit qualification, protected approval and provenance
apply to a first publication too. See
[npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/#prerequisites) and
[npm access-token permissions](https://docs.npmjs.com/about-access-tokens/).

1. **Prepare locally.** `pnpm release:prepare` (`scripts/release-prepare.mjs`) requires the exact
   `.nvmrc` Node patch, a clean tree and a HEAD containing `origin/main`. It fetches `origin/main` and
   tags (refusing to overwrite conflicting local tags), runs `pnpm changeset version`, refreshes the
   lockfile, then follows `PACKAGE_GENERATORS` for the exact generation order (preserve tagged
   history, stamp metadata, regenerate API and consumer references, build and measure each released
   package). A lyra-ui release also syncs the plugin versions, runs `./package.sh`, and rebuilds and
   remeasures because `package.sh` writes source; `node scripts/update-readme-status.mjs` runs last.
   It never lints, tests, packs, commits, tags or pushes. Changesets can auto-expand a release to a
   publishable dependent: the package-version delta, not the changeset list, is the release set. Only
   stable `major.minor.patch` versions are accepted.
2. **Commit and qualify.** Review, commit as `chore(release): <pkg>@<version>`, push to main. Push CI
   runs on that commit; dispatch `test-all-browsers.yml` (default browsers) and `full-engine.yml` on
   main for the same commit. Fix any failure with a new commit and requalify the new HEAD.
3. **Release on GitHub.** `gh workflow run release.yml --ref main` plans one `<directory>@<version>`
   tag per publishable package whose committed version is untagged (a named `package` input must be
   unreleased) and requires, through `release-integrity.mjs`, the exact-SHA `push`/`main` CI run and
   `workflow_dispatch`/`main` runs of both browser workflows. A credential-free job packs each
   tarball with the pinned Node and pnpm (the same command publish verification rebuilds with) and
   fails if packing changes tracked files. A job with no checkout then pushes the annotated tags
   atomically, creates each GitHub Release with the tarball and `CHANGELOG.md` (plus
   `custom-elements.json`, `llms.txt` and `llms-full.txt` for packages with a manifest generator) and
   dispatches `publish.yml` per tag. A release made with `GITHUB_TOKEN` emits no `release: published`
   event, so that dispatch is the only publish trigger.
4. **Publish.** Approve the `npm-publish` environment on each Publish run. UI releases also need a
   website deployment so `release-feed-freshness.yml` can confirm the upgrade feed matches npm;
   document-companion releases skip that automatic check.

The read-only publish verification job rejects a lightweight tag, verifies the annotated tag's peeled
commit is both the checkout and the invocation ref/SHA, then waits for one successful `push`/`main`
`ci.yml` run and successful `workflow_dispatch`/`main` runs of `test-all-browsers.yml` and
`full-engine.yml`, all with that `head_sha`. A manual invocation must therefore be dispatched on the
tag itself (`gh workflow run publish.yml --ref <tag> -f tag=<tag>`). Each run must contain successful
results for every job marked `release-qualification: required` or `release-qualification: matrix`,
and every job present must succeed, so a new gate cannot become non-blocking by accident. The exact
expanded job names live in `.github/release-qualification.json`; `generate-release-qualification.mjs
--check` derives them from all three workflow files, making matrix or display-name drift a freshness
failure. The browser run must contain Chromium, Chrome and Edge, and the full-engine run every
Firefox and WebKit shard. The helper reads the named runs and their jobs, not every check on the
commit (that would include the running publish job and deadlock). Its state-machine, tag and tarball
checks are tested in `scripts/release-integrity.test.mjs`.

The `npm-publish` environment is an external repository setting and must retain required reviewers;
verify with `gh api repos/aceshooting/lyra-ui/environments/npm-publish`. Credentials are minted only
after that gate. Before it, a read-only job requires exactly one `.tgz`, validates its identity,
rebuilds the tagged source, byte-compares both tarballs and uploads the verified bytes plus digest as
a 14-day artifact. The protected job has no checkout, install, lifecycle or repository-script
execution: it rechecks the digest and peeled remote tag, clobbers and round-trips the GitHub Release
tarball to close the approval-window mutation gap, then attests and `npm publish`es those same bytes.
A manual dry run passes the existing release asset to `npm publish --dry-run` without attesting or
publishing. Provenance keeps the action's Sigstore-bundle form (one compact bundle per line, wrapping
the in-toto statement) and is uploaded byte-identically as `.sigstore.json` for Sigstore tooling and
`.intoto.jsonl` for OpenSSF Scorecard discovery; verify with
`gh attestation verify <tarball> --bundle <file> --repo aceshooting/lyra-ui`.

`publish.yml` and the manual `sign-release.yml` recovery path both call `release-verification.yml`,
the single rebuild/byte-verification implementation; recovery keeps the same artifact handoff,
protected signer, post-approval tag check and asset round-trip, and is dispatched on the requested
tag, never on `main`.

Component release history needs a non-shallow clone with tags (`fetch-depth: 0` in every lint
worker). `history.taggedCurrent` preserves the immutable current-version tag record while the mutable
`history.current` evolves; APIs added after that tag are `unreleased` until the exact tag snapshot
rolls into `history.releases`.

The packed-consumer job runs the networked `check:public-api`: it downloads the latest published
package, safely unpacks it, and normalizes the CEM, wildcard exports, framework declarations, named
export declaration graphs, reachable event-detail types and documented event cancelability.
Removals, narrowing and default/reflection/event changes need a major bump; additive or widening
changes need at least a minor. Pending changesets must meet that minimum unless an exact, reviewed
entry in `scripts/public-api-semver-exceptions.json` matches the before/after values. Parser and
semver logic stay network-free under `test:public-api`.

Operational caveat: `.changeset/config.json`'s `"updateInternalDependencies": "patch"` governs only
regular `dependencies`/`devDependencies`. `@aceshooting/lyra-ui`'s `peerDependency` on
`@aceshooting/lyra-flags` (`workspace:^x.y.z`) escalates to a **major** bump the moment that peer's
version changes in the same `pnpm changeset version` run, whatever the pending changesets declare.

## Coverage floors (`scripts/coverage-floors.json`)

`web-test-runner.config.js` reads blocking per-metric thresholds from
`packages/lyra-ui/scripts/coverage-floors.json`, generated by
`node scripts/write-coverage-floors.mjs --write-floors` (from `packages/lyra-ui`, after a
`test:coverage` run wrote `coverage/`): each metric becomes `floor(measured − margin)` (default
margin 1.5 points) and the measurement and date are recorded beside it. Use `--minimum-lines <n>
--minimum-statements <n>` when a complete measurement supports reviewed minima; the generator refuses
a minimum above the measured result, needs the exact JSON summary for a statement minimum, and keeps
the minima on later refreshes (branch and function floors keep measured margins unless already
higher). It prefers `coverage/coverage-summary.json`, falling back to `coverage/lcov.info`, which has
no statement records (the statements figure then reuses lines, and the script says so).

- `pnpm --filter @aceshooting/lyra-ui check:coverage-floors` is the non-mutating mode (locally after
  `test:coverage`; in CI after the shard merge). It fails both ways: a floor above the measurement (the
  suite cannot pass) and a floor more than 5 points below it (it stopped gating anything).
- `--write-floors` never lowers a floor without `--allow-lower`, so a regression is an explicit diff
  line rather than a silent re-baseline.
- A floor only gates while it sits just under the measurement, which holds only if refreshing it is one
  mechanical command with a reviewable diff. The mirror failure is a threshold set _tighter_ than
  measurement from day one: red on arrival, it trains everyone to ignore the gate. Start every new
  budget or threshold (package size, qualification axe evidence, floors) from a measured baseline.

## Package-delivery budget

`pnpm --filter @aceshooting/lyra-ui check:package-size` reports the `npm pack --dry-run --json
--ignore-scripts` estimate after a build and checks its inventory against
`scripts/package-budgets.json`; `node packages/lyra-ui/scripts/check-package-size.mjs --tarball
<archive.tgz>` checks an existing archive (CI runs it right after the ATTW producer's real `pnpm
pack`), reading actual compressed size and validating the exact package name/version, unpacked sizes,
file count, required files and artifact hygiene. The dry-run figure is labelled an estimate because
package-manager compression can differ.

- The compressed download ceiling is strictly below 10 MB decimal (a 9,999,999-byte tarball passes,
  10,000,000 fails); `packedBudgetPolicy` names it and `maximum.packedBytes` is bound to it. There is
  no percentage-reduction target for packed size.
- The unpacked ceiling must satisfy the 25% reduction from the historical baseline recorded in the
  budget file (informational for packed size). Editor data (`@aceshooting/lyra-ide`) and locale
  catalogs (`@aceshooting/lyra-translations`) ship in companion packages, so no measured exception
  applies; each companion has hard ceilings under `companions` (check with
  `check-package-size.mjs --package <name> --tarball <archive>`).
- The file ceiling is derived exactly: base artifacts, one emitted JavaScript file per stable
  registration alias, a measured entry-point remainder and a seven-file reserve for the next component
  scaffold, below the historical file count. Validation requires the exact derivation.
- Required consumer docs, declarations, CSS and runtime artifacts stay required; the manifest, editor
  data and non-pseudo `dist/translations` must not appear in the lyra-ui tarball. Deleting public
  artifacts is not a size fix. Source, map, fixture, test and story rejection is independent of every
  size ceiling.
- `check:bundle-size` (`scripts/check-bundle-size.mjs`) bundles the published entry points after a
  build and fails gzip regressions against `scripts/bundle-budgets.json`; it re-measures every
  component entry so `scripts/bundle-stats.json` (README size badges, the website hero) cannot go
  stale (`--write-stats` refreshes). Every hard entry and aggregate ceiling is paired with its exact
  reviewed gzip measurement; the schema fails closed if either side is missing, a ceiling is below its
  measurement, or it carries more than 4% headroom. `--print-budget-review` emits a read-only
  proposal once the source set is final and never writes or loosens policy. Reviewed raises use
  `floor(measuredBytes * 1.02)` (JavaScript) or the next 64-byte boundary, CSS `floor(measuredBytes *
  1.04)`; a tighter existing canary stays tighter unless separately reviewed. Direct-entry bundles
  (all exports, relative dynamic imports inlined) and the side-effect-only, split-chunk consumer
  measurement answer different questions; neither replaces the other. Measurement options, optional-peer
  exclusions and the representative shell are changed only deliberately and stated with the change.
  Record reasons for any raised ceiling in the changeset; do not raise a budget merely to pass.

## `tsconfig.build.json` and dist hygiene

`pnpm --filter @aceshooting/lyra-ui build` is `scripts/build.mjs`, which runs
`tsc -p tsconfig.build.json`, not `tsconfig.json`. The build config turns `sourceMap` and
`declarationMap` off because `package.json#files` publishes `dist` and not `src`: maps pointed at
`src/**/*.ts` paths absent from an install (about 13 MB of tarball), and `declarationMap` also
misrouted Go-to-Definition away from the readable `.d.ts`. Maps stay on in `tsconfig.json`, so local
type-checking, `tsconfig.type-tests.json` and docs are unaffected.
`scripts/check-build-artifacts.mjs` asserts the result on emitted bytes (any `.map` under `dist`; any
`.js`/`.d.ts`/`.css` with a `sourceMappingURL` comment) so it survives changes in how the build is
spelled.

## `prepack` and editor data

`prepack` (`packages/lyra-ui/package.json#scripts.prepack`; read it for the chain) runs under
`npm pack`/`npm publish` and determines tarball contents. It starts with `package-metadata` so a
version bump cannot pack stale runtime version constants and includes `generate-editor-data`, which
regenerates `vscode-html-data.json`, `vscode-css-data.json` and `web-types.json` from
`custom-elements.json`. In `static-checks` the manifest is regenerated and diffed before editor data
(a stale manifest reddens the first diff, then editor data is generated from the corrected one); framework
type and LLM freshness are enforced inside `pnpm lint`. Whenever you touch the public surface (JSDoc,
attributes, parts, CSS properties), run `pnpm regen` and commit the whole set; one generator alone
leaves downstream outputs stale.

## Other package-local gates

Defer to `ci.yml` and `package.json#scripts` for when each runs.

- `check:source-policy` fails on banned source patterns (including the `localize()` literal-fallback
  mistake in [i18n-rtl-theming.md](i18n-rtl-theming.md)).
- `check:border-subtle` fails any literal `--lr-color-border-subtle` or
  `--lr-theme-color-surface-border-subtle` in `src/components/forms/**` or
  `src/internal/form-control.styles.ts`: that tier is decorative and may sit below the 3:1 a control
  boundary needs (WCAG 2.2 SC 1.4.11).
- `check:hit-area` (WCAG 2.5.8 target size) and `check:numeric-guards` (finite-number guards) are
  blocking parts of `contract-policy`.
- `check:script-paths` fails a `package.json` script that names a literal source path which no longer
  exists. It exists because `wtr` silently drops unresolved paths: after a directory restructure
  `test:platform` ran one file of 21 for a long time while the matrix reported green.
- `pnpm test:visual` runs the visual-regression suite against `visual-baselines/`.

## Dev command reference

The runnable command list is in [AGENTS.md](../../AGENTS.md#dev-commands-and-gates). Additional
notes: `pnpm build` runs `scripts/build.mjs` for lyra-ui (see above); `pnpm test` builds lyra-ui
first because its entrypoint tests import `dist/`; package-local forms exist under
`packages/lyra-ui/` (plus `pnpm test:watch`).

## `./package.sh` and the packaged references

`./package.sh` regenerates `packages/lyra-ui/llms/` itself before packaging, so after a doc change
run it directly rather than `pnpm run llms` then `./package.sh`: `pnpm lint` checks `llms/` but not the
packaged copy under `plugins/`. CI's `static-checks` runs it and `git diff --exit-code`s
`plugins/lyra-ui/skills/lyra-ui/CHANGELOG.md`, `plugins/lyra-ui/skills/lyra-ui/references/`,
`skills/lyra-ui.skill` and `skills/compose-lyra-interfaces.skill`. Those paths are GENERATED; never
hand-edit them. `packages/lyra-ui/llms-full.txt` is the GENERATED concatenation of the authored
`llms/<family>.md`, `llms/shared/*.md` (through the generated `llms/shared.md` compatibility
assembly) and `llms/00-*.md` sources (`pnpm run llms`); it is a repository archive, not an npm package
path, and `package.sh` ships the focused shared routes in the standalone reference tree as well.

## CI topology at a glance

Six check families (`lint`, `static-checks`, `build-and-coverage`, `packed-consumer`,
`docs-and-storybook`, `visual-regression`) plus the `platform-contracts` matrix run on every push;
`full-engine.yml` (weekly and manual) and `test-all-browsers.yml` (manual) are the complete-suite
sweeps. Releases require the push CI, the Chromium/Chrome/Edge Test All Browsers aggregates and every
full-engine shard (Firefox and WebKit) to succeed on the exact main commit before any tag is created.
