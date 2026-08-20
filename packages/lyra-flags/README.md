# @aceshooting/lyra-flags

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-flags)](https://www.npmjs.com/package/@aceshooting/lyra-flags)
[![npm downloads](https://img.shields.io/npm/dm/%40aceshooting%2Flyra-flags)](https://www.npmjs.com/package/@aceshooting/lyra-flags)
[![Node.js](https://img.shields.io/node/v/%40aceshooting%2Flyra-flags)](https://www.npmjs.com/package/@aceshooting/lyra-flags)
[![website](https://img.shields.io/badge/website-lyra--ui.com-6366f1)](https://www.lyra-ui.com/)

Waving country/territory flag SVGs (249 codes) — the optional companion asset package for
`<lr-flag>` in [`lyra-ui`](https://github.com/aceshooting/lyra-ui/tree/main/packages/lyra-ui).

## Install

```bash
pnpm add @aceshooting/lyra-flags
```

`lyra-ui` declares this as an **optional peer dependency** — installing `lyra-ui` alone never
pulls this package in. Add it explicitly if your app uses `<lr-flag>`.

## Usage

You normally never call this directly; `<lr-flag>` resolves it internally. Direct usage:

```js
import { flagUrl } from '@aceshooting/lyra-flags';

await flagUrl('fr'); // -> resolved URL of flags/fr.svg
```

`flagUrl()` selects one dynamically imported loader per flag, so a browser only fetches the
requested flag at runtime. Because the package exports a loader entry for every code, a production
bundler may still emit the complete reachable lazy-chunk graph even when the initial entry only
imports `flagUrl`; lazy network fetching and build-time pruning are separate concerns. Use a
literal `@aceshooting/lyra-flags/flags/<code>.svg` asset import, or copy only the required assets,
when the deployment artifact itself must contain a small allowlist.

For the opposite case — a consumer that genuinely wants every flag up front (e.g. a flag-picker
listing every country) — use `flagUrls()` instead:

```js
import { flagUrls } from '@aceshooting/lyra-flags';

const urls = await flagUrls(); // -> { ad: '...', ae: '...', ..., zw: '...' } — all 249 at once
```

For `<lr-flag>` specifically, `createFlagUrlResolver()` wraps `flagUrls()` into a ready-to-register
`flagUrl`-shaped resolver, so a page rendering many flags at once (a country table, a full locale
picker) doesn't have to pre-resolve and thread `src` by hand:

```js
import { createFlagUrlResolver } from '@aceshooting/lyra-flags';
import { setFlagUrlResolver } from '@aceshooting/lyra-ui/components/media/flag/flag.js';

setFlagUrlResolver(createFlagUrlResolver()); // one shared flagUrls() fetch backs every <lr-flag>
```

`@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js` does exactly this in one import, as
an opt-in alternative to the default `flag-peer.js` (never import both — the second
`setFlagUrlResolver()` call just replaces the first). Only the standard tier is bulk-fetched this
way; `fidelity="compact"/"detailed"` on individual elements still resolves through its own lazy
per-code loader.

## Fidelity tiers: compact / standard / detailed

A minority of flags (65 of 249) embed a detailed coat of arms, seal, or emblem in their source
artwork (e.g. `es`, `pt`, `sv`) — full illustrative vector detail that isn't visually
distinguishable at icon scale but costs real transfer bytes regardless (the worst case, `sv`, is
741 KB raw). Those 65 codes ship **three tiers**, each the best representation for a size band; pick
one with `flagUrl(code, { variant })` or `<lr-flag variant="...">`:

- **`compact`** — a tiny WebP raster (~1–3 KB) for icon-scale use (menu items, language selectors,
  dense lists; ~12–28px), where the emblem is a sub-pixel smudge anyway. At that size a downscaled
  raster is both crisper *and* far smaller than hundreds of sub-pixel vector paths.
- **`standard`** (the default — what `flagUrl(code)` / `<lr-flag country="...">` resolve to) — an
  aggressively-but-losslessly SVGO-optimized vector for card/row sizes (~28–96px). Every flag is
  under 80 KB, with no fidelity loss perceptible at that scale.
- **`detailed`** — the pristine, unmodified original vector, for rendering larger than icon scale
  (e.g. a hero display) where the extra illustrative detail is actually visible.

For the other 184 codes (already appropriately sized simple flags), every `variant` is a safe
no-op — all tiers resolve to the same small vector file.

```js
await flagUrl('es');                          // -> standard vector   (~48 KB)
await flagUrl('es', { variant: 'compact' });  // -> WebP raster       (~2 KB)
await flagUrl('es', { variant: 'detailed' }); // -> pristine original (~415 KB)
```

Every tier has a separate loader per flag **and** per tier. At runtime a compact request fetches
only its compact asset; a bundler can nevertheless emit all statically reachable tier chunks. Use
literal subpath asset imports when the deployment artifact must be pruned to a small allowlist.

### Per-tier entry points, for a consumer committed to one tier everywhere

The default `flagUrl()` above imports all three tiers' generated loader maps unconditionally, so it
can honour a per-call `variant` — a bundler may therefore include all three tiers' reachable chunks
even when an app only ever requests one. If every `<lr-flag>` in your app is pinned to the same
`fidelity` (no per-instance switching), import that tier's own entry point instead to exclude the
other two tiers from the reachable graph entirely:

```js
import { flagUrl } from '@aceshooting/lyra-flags/standard'; // only flags/generated.js
import { flagUrl } from '@aceshooting/lyra-flags/compact';  // + flags/generated-compact.js
import { flagUrl } from '@aceshooting/lyra-flags/detailed'; // + flags/generated-detailed.js
```

Each has the same `flagUrl(code): Promise<string | undefined>` shape as the default export, minus
the `options.variant` parameter (there is nothing else to select once committed to one tier); the
`compact`/`detailed` entries still fall back to the standard vector for a code with no distinct
tier asset, exactly like `flagUrl(code, { variant })` does. Register one with `<lr-flag>`'s
`setFlagUrlResolver()` from `@aceshooting/lyra-ui/components/media/flag/flag.js` instead of
importing `flag-peer.js` (which always registers the full three-tier resolver) when your app has
made this commitment.

`./standard` also exports `createFlagUrlResolver()`, so a tier-committed consumer can take the bulk
path above without reaching back through the package root:

```js
import { createFlagUrlResolver } from '@aceshooting/lyra-flags/standard';
import { setFlagUrlResolver } from '@aceshooting/lyra-ui/components/media/flag/flag.js';

setFlagUrlResolver(createFlagUrlResolver()); // one shared eager map, standard tier only
```

Bulk resolution never needed the other two tiers in the first place — it is backed by the same
standard-tier-only eager map either way — so the root version's three-tier import is inherited
purely from sharing a module with the variant-aware `flagUrl()`. Taking the bulk path through the
root therefore re-acquired the whole detailed + compact lazy-chunk graph; on a real production
build with a 156-country flag column, that was +65 detailed SVGs and +31 compact WebPs (+15.8MB of
emitted assets) that no route rendered. The returned resolver accepts and ignores an `options`
argument, so `<lr-flag fidelity="detailed">` resolves to that code's standard asset rather than
failing. `@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk-standard.js` does this
registration in one import, the tier-committed counterpart to `flag-peer-bulk.js`.

Maintainers, after adding/replacing source art: `pnpm run optimize` (re-derives the standard tier
from the pristine `flags/detailed/` originals) → `pnpm run build-compact` (renders the compact WebP
rasters) → `pnpm run generate` (updates the generated loader index).

## Asset provenance / license

The code in this package (`index.js`, `index.d.ts`) is MIT, © Aceshooting.

The flag artwork (`flags/*.svg`, and every `flags/detailed/*.svg`) is vendored from Google's
[**Noto Emoji**](https://github.com/googlefonts/noto-emoji) project
(`third_party/region-flags/waved-svg/`), traced there after visually matching three flags
(France, the US, the UK) pixel-for-pixel against that source. `flags/detailed/*.svg` (65 codes) are
unmodified; the corresponding `flags/*.svg` for those same 65 codes is an SVGO-optimized derivative,
and each `flags/compact/*.webp` is a downscaled raster derivative of the same original (see
"Fidelity tiers" above) — every other `flags/*.svg` is unmodified. Per that
directory's `LICENSE`: the flags were downloaded from Wikipedia/Wikimedia Commons and verified to be
**Public Domain or otherwise exempt from Copyright**. Full upstream `LICENSE`/`AUTHORS`/`README.third_party`
text, the exact source commit, and per-flag exceptions are reproduced in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

One caveat unrelated to copyright: some countries have laws restricting disrespectful or
commercial use of the national flag/emblem itself — that applies to any flag artwork
regardless of source, and re-sourcing doesn't change it.
