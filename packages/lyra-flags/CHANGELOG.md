# @aceshooting/lyra-flags

## 1.3.0

### Minor Changes

- 144ad8f: Add a `compact` flag tier and expose three fidelity tiers via `variant`.

  `@aceshooting/lyra-flags`: the ~65 emblem flags now ship a tiny WebP raster at
  `flags/compact/<code>.webp` (~1–3 KB) alongside the standard vector and the pristine `detailed`
  original. `flagUrl(code, { variant: 'compact' | 'standard' | 'detailed' })` selects a tier,
  code-split per flag _and_ per tier so a bundled app ships only the tiers it actually uses. The
  `standard` tier was also re-derived from the pristine originals so every flag is now under 80 KB
  (no fidelity loss perceptible at card/row scale).

  `@aceshooting/lyra-ui`: `<lyra-flag>` gains a `variant="compact" | "standard" | "detailed"`
  property — a tiny raster for icon-scale use (menu items, language selectors), the default
  icon-optimized vector for card/row sizes, or the pristine full-detail vector for hero display.
  The `detailed` boolean is deprecated but kept working as an alias for `variant="detailed"`.

## 1.2.0

### Minor Changes

- da766cb: Fixed 65 of 249 flags being wildly oversized (up to 759 KB raw for a single icon) due to unsimplified
  vector detail in their source art (a national coat of arms, seal, or emblem kept at full illustrative
  complexity — up to 1,533 `<path>` elements for a 24px icon). Each of those 65 codes now ships two
  variants:

  - **Default** (unchanged call sites — `flagUrl(code)`, `<lyra-flag country="...">`): an SVGO-optimized
    version tuned for icon-scale rendering, ~65% smaller on average for the 65 affected codes (the worst
    case, `sv`, goes from 759 KB to 194 KB), with no visible fidelity loss at icon scale — verified by
    rendering compact vs. detailed side-by-side at both 24px and 160px.
  - **Detailed** (opt-in, new): the pristine, unmodified original — `flagUrl(code, { variant: 'detailed'
})`, or `detailed` on `<lyra-flag>` (see the `@aceshooting/lyra-ui` changeset). A safe no-op for the
    other 184 codes, which were never large enough to need optimizing.

  Also exports `FLAG_LOADERS_DETAILED` (same lazy, code-split shape as `FLAG_LOADERS`, scoped to the 65
  codes with a detailed variant) and adds a `pnpm run optimize` maintenance script
  (`scripts/optimize-flags.mjs`, idempotent) for regenerating the compact/detailed split if a
  newly-added flag turns out to need it.

  No breaking changes — `flagUrl()`'s new second parameter is optional.

## 1.1.0

### Minor Changes

- c033ec0: `@aceshooting/lyra-flags`: `flagUrl(code)` is now genuinely code-split per flag — each code is
  its own dynamically-`import()`ed chunk, so using it (directly, or via `<lyra-flag
country=...>`/`<lyra-flag language=...>`) only ever fetches the flags actually requested at
  runtime, not all 249. This makes `flagUrl()` `async` (**breaking**: `Promise<string | undefined>`
  instead of `string`). `FLAG_URLS` (the old synchronous, eager, all-249-at-once map) is no longer
  exported from the package root — the equivalent for a consumer that genuinely wants every flag up
  front (e.g. a flag-picker listing every country) is the new `flagUrls()` (`async`, resolves the
  full map). `FLAG_LOADERS` (the new lazy per-code map `flagUrl()` is built on) is exported directly
  for consumers that want the per-code laziness without going through `flagUrl()`.

  `@aceshooting/lyra-ui`: `<lyra-flag>` transparently picks up the lazy-loading fix — no changes
  needed at call sites using `country`/`language`. Also adds a new `src` property: a pre-resolved
  flag image URL that takes precedence over `country`/`language` and skips the peer-package lookup
  (and its loading-skeleton round trip) entirely, for consumers who already have a flag's URL at
  build time (e.g. via `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`).

## 1.0.0

### Major Changes

- 99fb0e0: Added several new components
