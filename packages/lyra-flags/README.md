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

## Compact vs. detailed variants

A minority of flags (65 of 249) include a detailed coat of arms, seal, or emblem in their source
artwork (e.g. `es`, `pt`, `sv`) — full illustrative vector detail that isn't visually distinguishable
at icon scale but costs real transfer bytes regardless (the worst case, `sv`, was 759 KB raw before
optimization). Those 65 codes ship **two variants**:

- **Default** (what `flagUrl(code)` and `<lyra-flag country="...">` resolve to) — an SVGO-optimized
  version tuned for icon-scale rendering (16-24px), ~65% smaller on average for the 65 affected
  codes, with no visible fidelity loss at that scale.
- **Detailed** — the pristine, unmodified original — opt in with `flagUrl(code, { variant:
  'detailed' })` or `<lyra-flag detailed>`, for a use case where the flag renders larger than icon
  scale (e.g. a hero display) and the extra detail is actually visible.

For the other 184 codes (already appropriately sized), `variant: 'detailed'`/`detailed` is a safe
no-op — both resolve to the same file.

```js
await flagUrl('es'); // -> compact, icon-optimized (~118 KB, was ~425 KB)
await flagUrl('es', { variant: 'detailed' }); // -> pristine original (~425 KB)
```

Maintainers: `pnpm run optimize` (idempotent — re-running is a no-op for a code already processed)
regenerates the compact/detailed split for any newly-added oversized flag; follow with `pnpm run
generate` to update the generated loader index.

## Asset provenance / license

The code in this package (`index.js`, `index.d.ts`) is MIT, © Aceshooting.

The flag artwork (`flags/*.svg`, and every `flags/detailed/*.svg`) is vendored from Google's
[**Noto Emoji**](https://github.com/googlefonts/noto-emoji) project
(`third_party/region-flags/waved-svg/`), traced there after visually matching three flags
(France, the US, the UK) pixel-for-pixel against that source. `flags/detailed/*.svg` (65 codes) are
unmodified; the corresponding `flags/*.svg` for those same 65 codes is an SVGO-optimized derivative
(see "Compact vs. detailed variants" above) — every other `flags/*.svg` is unmodified. Per that
directory's `LICENSE`: the flags were downloaded from Wikipedia/Wikimedia Commons and verified to be
**Public Domain or otherwise exempt from Copyright**. Full upstream `LICENSE`/`AUTHORS`/`README.third_party`
text, the exact source commit, and per-flag exceptions are reproduced in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

One caveat unrelated to copyright: some countries have laws restricting disrespectful or
commercial use of the national flag/emblem itself — that applies to any flag artwork
regardless of source, and re-sourcing doesn't change it.
