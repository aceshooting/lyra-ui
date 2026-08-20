# @aceshooting/lyra-flags

## 2.2.0

### Minor Changes

- bd0f05f: `createFlagUrlResolver()` is now exported from `@aceshooting/lyra-flags/standard`, not only from the
  package root.
  
  2.1.0 shipped two things that solved two different problems and could not be used together. The
  tier-committed entry points (`./standard`, `./compact`, `./detailed`) import only their own generated
  loader map, which is what closes the "importing the peer at all makes the whole three-tier lazy-chunk
  graph reachable" problem. But each exported only `flagUrl` and its tier's `FLAG_LOADERS`;
  `createFlagUrlResolver()` lived solely on the root, which statically imports all three tiers' maps so
  the root `flagUrl()` can honour a per-call `variant`. Taking the bulk path therefore meant reaching
  back through the root and re-acquiring exactly the cost the per-tier entries exist to avoid.
  
  The three-tier import was never needed for the bulk path: `flagUrls()` reads `flags/eager.js`, which
  is standard-tier-only by construction — `createFlagUrlResolver()`'s own doc comment says so. The
  coupling was inherited purely from sharing a module with the variant-aware `flagUrl()`.
  
  A consumer measured the difference on a real 12-route production build with a 156-country flag
  column, swapping only the resolver registration: 10,168,801 bytes of assets via `./standard` against
  25,983,335 bytes via the root — +15.8 MB of flag assets no route renders (+65 SVGs, the whole
  detailed tier; +31 WebPs, the whole compact tier). The bulk path's real win, 344 JS chunks collapsing
  to 226 as the per-code loader chunks become one eager map, was completely swamped by it.
  
  `@aceshooting/lyra-ui` gains a matching `flag-peer-bulk-standard.js` registration entry, so a
  tier-committed consumer can take the bulk path without re-reaching the root.

## 2.1.0

### Minor Changes

- a44e6e1: Added a first-class bulk-resolution path for `<lr-flag>`, for a page that renders most/all flags at
  once (a country table, a full locale picker) instead of independently resolving each instance:
  
  - `@aceshooting/lyra-flags` gained `createFlagUrlResolver()`, a `flagUrl`-shaped resolver factory
    backed by one shared `flagUrls()` fetch instead of a fresh per-code lazy resolution per call.
  - `@aceshooting/lyra-ui` gained `flag-peer-bulk.js` (`components/media/flag/flag-peer-bulk.js`), an
    opt-in alternative peer-registration entry point to the default `flag-peer.js` — import one or the
    other, never both. Only worthwhile when the page renders most/all flags; `flag-peer.js` remains
    the right default for a handful of flags. `fidelity="compact"/"detailed"` on individual elements
    still resolves correctly either way — only the standard tier is bulk-fetched.
- a44e6e1: Added `./standard`, `./compact`, and `./detailed` package entry points, each exporting a
  tier-committed `flagUrl(code)` with the same shape as the package root's, minus `options.variant`.
  The root's `flagUrl()` statically imports all three tiers' generated loader maps so it can honour a
  per-call `variant`, so a bundler may include all three tiers' reachable chunks even when an app only
  ever requests one fidelity. A consumer whose whole app is pinned to one `fidelity` (no per-instance
  switching) can import the matching entry instead — `./standard` imports only `flags/generated.js`;
  `./compact`/`./detailed` add only their own tier's generated map, never the other's — excluding the
  unused tier(s) from the reachable graph. Register one with `<lr-flag>`'s `setFlagUrlResolver()`
  instead of importing `flag-peer.js` (which always registers the full three-tier resolver).

## 2.0.0

### Major Changes

- e7d8b83: Version 2.0.0 marks the `lr-*` era of the flags package, released alongside
  `@aceshooting/lyra-ui` 4.0.0's public-prefix rename: the package description, README, and
  JSDoc now reference `<lr-flag>` (formerly `<lyra-flag>`). The package's own exports
  (`flagUrl()`), file layout, and SVG assets are unchanged — upgrading requires no code
  changes beyond using lyra-ui 4.0.0's `<lr-flag>` tag itself.

## 1.4.0

### Minor Changes

- 9f3afbe: Corrects the README and inline JSDoc's description of `flagUrl()`/`flagUrls()`'s code-splitting
  behavior: earlier wording claimed a production bundler ships only the specific flags an app
  references (e.g. "referencing 2 codes shipped ~28 KB total, not all 249"). That's true of what the
  _browser fetches at runtime_, but a bundler may still emit the complete reachable lazy-chunk graph
  at build time since every supported code has a literal loader import. Docs now recommend a literal
  `@aceshooting/lyra-flags/flags/<code>.svg` subpath import (or copying only the required assets)
  when the deployment artifact itself must be pruned to a small allowlist. No runtime behavior
  change. Also refreshes package metadata (`keywords`, `homepage`, `packageManager`, `svgo`
  devDependency).

## 1.3.0

### Minor Changes

- 144ad8f: Add a `compact` flag tier and expose three fidelity tiers via `variant`.

  `@aceshooting/lyra-flags`: the ~65 emblem flags now ship a tiny WebP raster at
  `flags/compact/<code>.webp` (~1–3 KB) alongside the standard vector and the pristine `detailed`
  original. `flagUrl(code, { variant: 'compact' | 'standard' | 'detailed' })` selects a tier,
  code-split per flag _and_ per tier so a bundled app ships only the tiers it actually uses. The
  `standard` tier was also re-derived from the pristine originals so every flag is now under 80 KB
  (no fidelity loss perceptible at card/row scale).

  `@aceshooting/lyra-ui`: `<lr-flag>` gains a `variant="compact" | "standard" | "detailed"`
  property — a tiny raster for icon-scale use (menu items, language selectors), the default
  icon-optimized vector for card/row sizes, or the pristine full-detail vector for hero display.
  The `detailed` boolean is deprecated but kept working as an alias for `variant="detailed"`.

## 1.2.0

### Minor Changes

- da766cb: Fixed 65 of 249 flags being wildly oversized (up to 759 KB raw for a single icon) due to unsimplified
  vector detail in their source art (a national coat of arms, seal, or emblem kept at full illustrative
  complexity — up to 1,533 `<path>` elements for a 24px icon). Each of those 65 codes now ships two
  variants:

  - **Default** (unchanged call sites — `flagUrl(code)`, `<lr-flag country="...">`): an SVGO-optimized
    version tuned for icon-scale rendering, ~65% smaller on average for the 65 affected codes (the worst
    case, `sv`, goes from 759 KB to 194 KB), with no visible fidelity loss at icon scale — verified by
    rendering compact vs. detailed side-by-side at both 24px and 160px.
  - **Detailed** (opt-in, new): the pristine, unmodified original — `flagUrl(code, { variant: 'detailed'
})`, or `detailed` on `<lr-flag>` (see the `@aceshooting/lyra-ui` changeset). A safe no-op for the
    other 184 codes, which were never large enough to need optimizing.

  Also exports `FLAG_LOADERS_DETAILED` (same lazy, code-split shape as `FLAG_LOADERS`, scoped to the 65
  codes with a detailed variant) and adds a `pnpm run optimize` maintenance script
  (`scripts/optimize-flags.mjs`, idempotent) for regenerating the compact/detailed split if a
  newly-added flag turns out to need it.

  No breaking changes — `flagUrl()`'s new second parameter is optional.

## 1.1.0

### Minor Changes

- c033ec0: `@aceshooting/lyra-flags`: `flagUrl(code)` is now genuinely code-split per flag — each code is
  its own dynamically-`import()`ed chunk, so using it (directly, or via `<lr-flag
country=...>`/`<lr-flag language=...>`) only ever fetches the flags actually requested at
  runtime, not all 249. This makes `flagUrl()` `async` (**breaking**: `Promise<string | undefined>`
  instead of `string`). `FLAG_URLS` (the old synchronous, eager, all-249-at-once map) is no longer
  exported from the package root — the equivalent for a consumer that genuinely wants every flag up
  front (e.g. a flag-picker listing every country) is the new `flagUrls()` (`async`, resolves the
  full map). `FLAG_LOADERS` (the new lazy per-code map `flagUrl()` is built on) is exported directly
  for consumers that want the per-code laziness without going through `flagUrl()`.

  `@aceshooting/lyra-ui`: `<lr-flag>` transparently picks up the lazy-loading fix — no changes
  needed at call sites using `country`/`language`. Also adds a new `src` property: a pre-resolved
  flag image URL that takes precedence over `country`/`language` and skips the peer-package lookup
  (and its loading-skeleton round trip) entirely, for consumers who already have a flag's URL at
  build time (e.g. via `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`).

## 1.0.0

### Major Changes

- 99fb0e0: Added several new components
