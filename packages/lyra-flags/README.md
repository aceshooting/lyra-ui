# @aceshooting/lyra-flags

Waving country/territory flag SVGs (249 codes) — the optional companion asset package for
`<lyra-flag>` in [`lyra-ui`](https://github.com/aceshooting/lyra-ui/tree/main/packages/lyra-ui).

## Install

```bash
pnpm add @aceshooting/lyra-flags
```

`lyra-ui` declares this as an **optional peer dependency** — installing `lyra-ui` alone never
pulls this package in. Add it explicitly if your app uses `<lyra-flag>`.

## Usage

You normally never call this directly; `<lyra-flag>` resolves it internally. Direct usage:

```js
import { flagUrl } from '@aceshooting/lyra-flags';

await flagUrl('fr'); // -> resolved URL of flags/fr.svg
```

`flagUrl()` is genuinely code-split per flag — each code is its own dynamically-`import()`ed
chunk, so calling `flagUrl('fr')` only ever fetches `fr`'s asset, never the other 248. That's why
it's `async`: this is a real, separate lazy-load per code, not a lookup into one eagerly-bundled
map (verified with a real Vite build: referencing 2 codes shipped ~28 KB total, not all 249).

For the opposite case — a consumer that genuinely wants every flag up front (e.g. a flag-picker
listing every country) — use `flagUrls()` instead:

```js
import { flagUrls } from '@aceshooting/lyra-flags';

const urls = await flagUrls(); // -> { ad: '...', ae: '...', ..., zw: '...' } — all 249 at once
```

## Fidelity tiers: compact / standard / detailed

A minority of flags (65 of 249) embed a detailed coat of arms, seal, or emblem in their source
artwork (e.g. `es`, `pt`, `sv`) — full illustrative vector detail that isn't visually
distinguishable at icon scale but costs real transfer bytes regardless (the worst case, `sv`, is
741 KB raw). Those 65 codes ship **three tiers**, each the best representation for a size band; pick
one with `flagUrl(code, { variant })` or `<lyra-flag variant="...">`:

- **`compact`** — a tiny WebP raster (~1–3 KB) for icon-scale use (menu items, language selectors,
  dense lists; ~12–28px), where the emblem is a sub-pixel smudge anyway. At that size a downscaled
  raster is both crisper *and* far smaller than hundreds of sub-pixel vector paths.
- **`standard`** (the default — what `flagUrl(code)` / `<lyra-flag country="...">` resolve to) — an
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

Every tier is code-split per flag **and** per tier: a bundled app that only ever requests
`variant: 'compact'` for a handful of codes ships only those few compact WebPs — never their
standard or detailed variants, and never the other flags.

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
