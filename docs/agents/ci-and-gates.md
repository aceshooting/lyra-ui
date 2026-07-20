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

**The `build-test` job is the authoritative gate list and reproduction sequence.** Read it
directly rather than trusting a restated list, and reproduce a CI failure locally with the same
commands in the same order. Currently:

1. `install --frozen-lockfile`; Playwright Chromium install; `lint`.
2. `build`, **then** `check:bundle-size` (gzip-size regression gate against
   `scripts/bundle-budgets.json`) plus a non-fatal bundle-analysis upload to Codecov
   (`codecov:bundle`, no-ops without `CODECOV_TOKEN`).
3. `pnpm --filter '!@aceshooting/lyra-ui' -r test` — every *other* workspace package (e.g.
   lyra-flags's own test script).
4. `test:coverage` — the one time lyra-ui's own Chromium suite actually runs (a separate
   `pnpm test` step would just re-run the identical file set with coverage instrumentation off).
   Build must precede it: `src/package-entrypoints.test.ts` dynamically imports the published
   `./dist/lyra.js` entry points, which only exist after a build. Then coverage/test-result
   uploads to Codecov.
5. `manifest`, then `git diff --exit-code` on `custom-elements.json` (the freshness check — a
   standalone `manifest:check` step would be redundant with this).
6. `readme:check`; `./package.sh` (regenerates the plugin's
   `plugins/lyra-ui/skills/lyra-ui/references/`, immediately diffed for staleness) +
   `skill:check`.
7. `docs:build`; `git diff --exit-code` on `.storybook/sitemap.xml` + `docs:check`;
   `storybook:check`; `storybook:check-theme`.
8. A non-blocking, informational visual-regression screenshot run (`test:visual`) against
   `visual-baselines/`.
9. `pnpm --filter @aceshooting/lyra-ui pack --dry-run` — checks the published tarball still
   contains `custom-elements.json`/`llms.txt`/`llms-full.txt`/`llms/` — then
   `check:packed-consumer`.

A separate `platform-contracts` matrix job runs the platform contract suite (`test:platform`)
against Firefox/WebKit on Node 20/22.

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
