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

## CI: `.github/workflows/ci.yml` is authoritative

**`ci.yml` is the authoritative gate list and reproduction sequence.** Read it directly rather
than trusting a restated list, and reproduce a CI failure locally with the same commands in the
same order. The old single `build-test` job was one linear sequence; it's now six primary jobs split
along real data dependencies (verified against the actual scripts, not assumed) so independent
gates run in parallel instead of queueing behind each other. If a check goes red, the job name in
the PR checks list tells you which of these to reproduce locally:

1. **`lint`** — `pnpm install --frozen-lockfile`; `pnpm lint`. No Playwright and no build:
   `contract-policy` + `tsc --noEmit` + `test:types` are pure static analysis.
2. **`static-checks`** — everything whose inputs are already-committed files, needing neither a
   library build nor a docs build. After `pnpm install --frozen-lockfile`, its exact command order
   is: `pnpm --filter '!@aceshooting/lyra-ui' -r test`; `pnpm run check:dead-code`; `pnpm run
   check:secrets`; `pnpm registrations` then a targeted diff of `src/lyra.ts`, the
   root-registration allowlist, and `package.json`; `pnpm manifest` then a targeted diff of
   `custom-elements.json`; `pnpm --filter @aceshooting/lyra-ui run generate-editor-data` then a
   targeted diff of the two VS Code data files and `web-types.json`; `pnpm readme:check`;
   `./package.sh` then a targeted diff of both the generated plugin references and the tracked
   `skills/lyra-ui.skill` archive; `pnpm skill:check` (plugin/marketplace manifest consistency,
   not archive freshness); `pnpm storybook:check-theme`.
3. **`build-and-coverage`** — the longest job (`test:coverage` alone runs ~4.5min), kept as one
   job because everything in it is sequentially dist-dependent. After install and Playwright
   Chromium setup, its exact command order is: `pnpm build`; `pnpm --filter
   @aceshooting/lyra-ui test:ssr`; `pnpm --filter @aceshooting/lyra-ui test:hydration`; `pnpm
   --filter @aceshooting/lyra-ui check:bundle-size`; non-fatal `pnpm --filter
   @aceshooting/lyra-ui codecov:bundle`; `pnpm --filter @aceshooting/lyra-ui test:coverage`;
   non-fatal Codecov coverage and test-result upload actions. This is the one time lyra-ui's own
   Chromium suite runs; a separate `pnpm test` would repeat the same files without coverage.
4. **`packed-consumer`** — needs `dist/` (the tarball's `files` list includes it) but nothing
   else `build-and-coverage` needs, so it gets its own `pnpm build` rather than waiting on that
   job. It then runs `pnpm --filter @aceshooting/lyra-ui pack --dry-run`, verifies
   `dist/ssr-loader.js`, `custom-elements.json`, `llms.txt`, `llms-full.txt`, and the required
   `llms/` index/shared/tokens/peers/migration/component files, then runs `pnpm
   check:packed-consumer`.
5. **`docs-and-storybook`** — `docs:build` only needs the already-committed
   `custom-elements.json` (via its internal `manifest:check`), not `dist/`, so this is independent
   of the two build jobs above; `storybook:check` drives Chromium against the built
   `storybook-static/`, so this job still installs Playwright. After install and Chromium setup,
   its exact order is: `pnpm docs:build` (with `CODECOV_TOKEN`); targeted sitemap diff; `pnpm
   docs:check`; `pnpm storybook:check`; `pnpm docs:check-show-code`.
6. **`visual-regression`** — blocking as of the 2026-07-20 font-substitution determinism fix (see
   `packages/lyra-ui/visual-baselines/README.md`), and split into its own job so its ~3.5min
   `test:visual` run doesn't sit in the critical path of the faster `docs-and-storybook` checks:
   install; Playwright Chromium setup; `pnpm docs:build` **without** `CODECOV_TOKEN`; `pnpm
   --filter @aceshooting/lyra-ui test:visual`; unconditional diff-artifact upload.

A separate `platform-contracts` matrix job runs the platform contract suite (`test:platform`)
against Firefox and WebKit on Node 20 and Node 22. Every leg sets
`npm_config_manage_package_manager_versions=false`, installs with `--frozen-lockfile`, installs
its browser, sets `WTR_BROWSER` and `WTR_STRICT_CONSOLE=1`, then runs `pnpm --filter
@aceshooting/lyra-ui test:platform`. Node 20 uses the pnpm version pinned in
`.github/ci-pnpm10.json` (`pnpm@10.34.5`); Node 22 uses `package.json#packageManager`
(`pnpm@11.18.0`). The package's supported engine remains `node >=20`; the primary six jobs use
Node 22, while this matrix proves the Node 20 browser contract explicitly.

## Scheduled full Firefox/WebKit suite

`.github/workflows/full-engine.yml` complements the fast pull-request matrix with the complete
non-coverage `src/**/*.test.ts` suite in Firefox and WebKit. It runs weekly and can also be started
with `workflow_dispatch`. Each browser is split into four deterministic round-robin shards under
Node 22. The runner discovers and lexically sorts the live test inventory, so every test file runs
exactly once across the four shards without maintaining a second allowlist.

Every shard builds first because `package-entrypoints.test.ts` imports the package's built `dist/`
targets. It then runs with strict browser-console handling. The smaller `test:platform` matrix in
`ci.yml` remains the blocking Node 20/22 pull-request contract and does not substitute for this
complete scheduled sweep.

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
only and does not replace the blocking bundle-size gate.

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

## `prepack` and editor data

**`prepack`** (`manifest` → `framework-types` → `build` → `generate-editor-data` → `llms`;
`packages/lyra-ui/package.json`) determines tarball contents on `npm pack`/`npm publish`, run by
npm itself rather than as one monolithic CI command. `generate-editor-data` regenerates
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
  and the lyra-ui.com hero) cannot go stale — regenerate both files with `--write-budgets`.
- `pnpm test:visual` runs the visual-regression screenshot suite against `visual-baselines/`.

`check:hit-area` (WCAG 2.5.8 tappable-size floor) and `check:numeric-guards` (finite-number guards
on numeric properties) are now blocking parts of `contract-policy`; both currently pass with all
known exceptions explicit. Don't assume a check doesn't exist just because it is not listed here —
`ls packages/lyra-ui/scripts/check-*.mjs` is the real inventory. `pnpm run check:script-paths` guards
the inverse mistake (a `package.json` script naming a literal source path that no longer exists):
it exists because `test:platform` kept 21 hardcoded test paths across the 11-family restructure —
20 stopped resolving, `wtr` silently dropped them rather than erroring, and the Firefox/WebKit
matrix reported green while running one test file out of 21 for an extended period.
