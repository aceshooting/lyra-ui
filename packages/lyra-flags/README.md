# @aceshooting/lyra-flags

Waving country/territory flag PNGs (249 codes) — the optional companion asset package for
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

flagUrl('fr'); // -> resolved URL of flags/fr.png
```

## ⚠️ Asset provenance / license

The code in this package (`index.js`, `index.d.ts`) is MIT, © Aceshooting.

**The flag artwork itself (`flags/*.png`) has unverified provenance.** These waving-flag PNGs
were carried over from an internal asset folder with no attribution or license file attached.
Before distributing this package publicly (or relying on it in a commercial product), verify
the source and licensing terms of this artwork, or replace it with a flag set you can confirm
the license for. Do not assume MIT applies to the images.
