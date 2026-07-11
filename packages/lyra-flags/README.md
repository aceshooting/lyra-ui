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

flagUrl('fr'); // -> resolved URL of flags/fr.svg
```

## Asset provenance / license

The code in this package (`index.js`, `index.d.ts`) is MIT, © Aceshooting.

The flag artwork (`flags/*.svg`) is vendored unmodified from Google's
[**Noto Emoji**](https://github.com/googlefonts/noto-emoji) project
(`third_party/region-flags/waved-svg/`), traced there after visually matching three flags
(France, the US, the UK) pixel-for-pixel against that source. Per that directory's `LICENSE`:
the flags were downloaded from Wikipedia/Wikimedia Commons and verified to be **Public Domain
or otherwise exempt from Copyright**. Full upstream `LICENSE`/`AUTHORS`/`README.third_party`
text, the exact source commit, and per-flag exceptions are reproduced in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

One caveat unrelated to copyright: some countries have laws restricting disrespectful or
commercial use of the national flag/emblem itself — that applies to any flag artwork
regardless of source, and re-sourcing doesn't change it.
