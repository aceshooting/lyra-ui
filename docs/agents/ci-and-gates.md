# CI, lint gates, and release plumbing — lyra-ui agent reference

> Detail behind the "Dev commands and gates" section of [AGENTS.md](../../AGENTS.md). The digest
> there is the contract; this file carries the full gate lists, ordering rationale, and incidents.

## `contract-policy` (most of `pnpm lint`'s time)

Chains, in order: `check:script-paths`, `style-policy`, `check:source-policy`,
`check:part-reachability` + `test:part-reachability` (its own self-test), `provenance-policy`
(`check-provenance.mjs`), `contract-checklist` (`check-contract-checklist.mjs` — distinct from
AGENTS.md's own `contract-checklist.json` data), `check-component-coverage.mjs`, `manifest:check`
+ `manifest:coverage`, `llms-freshness` + `llms:check`
(`check-llms-freshness.mjs`/`check-llms-artifacts.mjs`), `test:architecture`
(`check-registration-architecture.mjs`), `check-side-effects`, `check:form-associated`,
`check:event-barrel`. The authoritative list is `packages/lyra-ui/package.json`'s
`contract-policy` script entry — restatements here drift faster than this file gets updated.

## CI: `.github/workflows/ci.yml` is authoritative

**`ci.yml` is the authoritative gate list and reproduction sequence.** Read it directly rather
than trusting a restated list, and reproduce a CI failure locally with the same commands in the
same order. The old single `build-test` job was one linear sequence; it's now six jobs split
along real data dependencies (verified against the actual scripts, not assumed) so independent
gates run in parallel instead of queueing behind each other. If a check goes red, the job name in
the PR checks list tells you which of these to reproduce locally:

1. **`lint`** — `install --frozen-lockfile`; `lint`. No Playwright, no build: `contract-policy` +
   `tsc --noEmit` + `test:types` are pure static analysis.
2. **`static-checks`** — everything that only reads already-committed files, needing neither a
   library build nor a docs build: `pnpm --filter '!@aceshooting/lyra-ui' -r test` (every *other*
   workspace package, e.g. lyra-flags's own test script); `manifest` then `git diff --exit-code`
   on `custom-elements.json` (the freshness check — a standalone `manifest:check` step would be
   redundant with this); `readme:check`; `./package.sh` (regenerates the plugin's
   `plugins/lyra-ui/skills/lyra-ui/references/`, immediately diffed for staleness) +
   `skill:check`; `storybook:check-theme` (reads `.storybook/preview.js` directly, no Storybook
   build needed despite the name).
3. **`build-and-coverage`** — the longest job (`test:coverage` alone runs ~4.5min), kept as one
   job because everything in it is sequentially dist-dependent: Playwright Chromium install;
   `build`, **then** `check:bundle-size` (gzip-size regression gate against
   `scripts/bundle-budgets.json`) plus a non-fatal bundle-analysis upload to Codecov
   (`codecov:bundle`, no-ops without `CODECOV_TOKEN`); `test:coverage` — the one time lyra-ui's
   own Chromium suite actually runs (a separate `pnpm test` step would just re-run the identical
   file set with coverage instrumentation off) — build must precede it, since
   `src/package-entrypoints.test.ts` dynamically imports the published `./dist/lyra.js` entry
   points, which only exist after a build; then coverage/test-result uploads to Codecov.
4. **`packed-consumer`** — needs `dist/` (the tarball's `files` list includes it) but nothing
   else `build-and-coverage` needs, so it gets its own `build` rather than waiting on that job:
   `pnpm --filter @aceshooting/lyra-ui pack --dry-run` — checks the published tarball still
   contains `custom-elements.json`/`llms.txt`/`llms-full.txt`/`llms/` — then
   `check:packed-consumer`.
5. **`docs-and-storybook`** — `docs:build` only needs the already-committed
   `custom-elements.json` (via its internal `manifest:check`), not `dist/`, so this is independent
   of the two build jobs above; `storybook:check` drives Chromium against the built
   `storybook-static/`, so this job still installs Playwright: `docs:build` (with
   `CODECOV_TOKEN` — see note below); `git diff --exit-code` on `.storybook/sitemap.xml`;
   `docs:check`; `storybook:check`.
6. **`visual-regression`** — non-blocking (`continue-on-error: true` at job *and* step level), and
   split into its own job specifically so its ~3.5min `test:visual` run doesn't sit in the
   critical path of jobs that actually gate merges: Playwright Chromium install; `docs:build`
   (**without** `CODECOV_TOKEN` — only `docs-and-storybook`'s copy carries the token, so the
   Storybook bundle-analysis upload doesn't fire twice for the same commit); the informational
   `test:visual` screenshot run against `visual-baselines/`; diff-artifact upload.

A separate `platform-contracts` matrix job runs the platform contract suite (`test:platform`)
against Firefox/WebKit on Node 20/22, as before.

## `prepack` and editor data

**`prepack`** (`build` → `manifest` → `generate-editor-data` → `llms`;
`packages/lyra-ui/package.json`) determines tarball contents on `npm pack`/`npm publish`, run by
npm itself rather than CI. `generate-editor-data` regenerates `vscode-html-data.json`,
`vscode-css-data.json`, and `web-types.json` from `custom-elements.json`; unlike
`custom-elements.json`, those three have NO CI freshness gate, so a manual edit to a component's
JSDoc/attributes can leave them silently stale — regenerate and commit them together by hand
whenever you touch the public surface.

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

## Deliberately non-blocking gates — run them by hand

`pnpm run check:hit-area` (WCAG 2.5.8 tappable-size floor) and `pnpm run check:numeric-guards`
(finite-number guards on numeric properties) still report real, unfixed findings, so they're
wired as named scripts for discoverability rather than into `contract-policy`. Run them on any PR
touching an icon-sized control or a `type: Number` property. Don't assume a check doesn't exist
just because `pnpm lint` stays green — `ls packages/lyra-ui/scripts/check-*.mjs` is the real
inventory. `pnpm run check:script-paths` guards the inverse mistake (a `package.json` script
naming a literal source path that no longer exists): it exists because `test:platform` kept 21
hardcoded test paths across the 11-family restructure — 20 stopped resolving, `wtr` silently
dropped them rather than erroring, and the Firefox/WebKit matrix reported green while running one
test file out of 21 for an extended period.
