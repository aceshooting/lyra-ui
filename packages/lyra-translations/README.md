# @aceshooting/lyra-translations

[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-translations)](https://www.npmjs.com/package/@aceshooting/lyra-translations)
[![Node.js](https://img.shields.io/node/v/%40aceshooting%2Flyra-translations)](https://www.npmjs.com/package/@aceshooting/lyra-translations)

The built-in locale catalogs for [`@aceshooting/lyra-ui`](https://github.com/aceshooting/lyra-ui/tree/main/packages/lyra-ui).
English is built into `lyra-ui`; every other locale is an opt-in, side-effect-only import from this package.

## Install

```bash
pnpm add @aceshooting/lyra-ui @aceshooting/lyra-translations
```

`@aceshooting/lyra-ui` is a required peer (same major). `lyra-ui` declares this package as an optional
peer, so install it only when your app needs a non-English locale or `loadLyraLocale()`.

## Usage

Import a locale to register it, then select it:

```js
import '@aceshooting/lyra-translations/fr.js';
import { setLyraLocale } from '@aceshooting/lyra-ui/localization.js';

setLyraLocale('fr');
```

Each locale also has one slice per component family for smaller bundles, for example
`@aceshooting/lyra-translations/fr/forms.js`. `locales.json` in `@aceshooting/lyra-ui` lists every
locale with its exact import specifiers, direction and coverage.

To load catalogs lazily instead, use `loadLyraLocale()` from `@aceshooting/lyra-ui/locale-loader.js`;
it imports from this package.

Migrating from `@aceshooting/lyra-ui` 26 or earlier: install this package and change
`@aceshooting/lyra-ui/translations/<locale>.js` to `@aceshooting/lyra-translations/<locale>.js`. The
pseudo-locales (`translations/pseudo/en-XA.js`, `ar-XB.js`) stay in `@aceshooting/lyra-ui`.

## Versioning

This package is versioned together with `@aceshooting/lyra-ui`; use matching versions.

MIT licensed.
