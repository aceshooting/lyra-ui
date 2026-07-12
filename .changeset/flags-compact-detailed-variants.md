---
"@aceshooting/lyra-flags": minor
---

Fixed 65 of 249 flags being wildly oversized (up to 759 KB raw for a single icon) due to unsimplified
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
