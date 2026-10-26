# @aceshooting/lyra-translations

[![Coverage](https://img.shields.io/endpoint?url=https://aceshooting.github.io/lyra-ui/badges/coverage-lyra-translations.json)](https://codecov.io/gh/aceshooting/lyra-ui)

[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-translations)](https://www.npmjs.com/package/@aceshooting/lyra-translations)
[![Node.js](https://img.shields.io/node/v/%40aceshooting%2Flyra-translations)](https://www.npmjs.com/package/@aceshooting/lyra-translations)

The built-in locale catalogs for [`@aceshooting/lyra-ui`](https://github.com/aceshooting/lyra-ui/tree/main/packages/lyra-ui).
English is built into `lyra-ui`; every other locale is an opt-in, side-effect-only import from this package.

## Install

```bash
pnpm add @aceshooting/lyra-ui @aceshooting/lyra-translations
```

Use the same version as the required `@aceshooting/lyra-ui` peer. Lyra UI declares this package as
optional, so install it only when your app needs a non-English locale or `loadLyraLocale()`.

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

The `conversation` slice also includes the seven `genView*` renderer messages used by the optional
`@aceshooting/lyra-gen` companion. Full locale imports include them automatically. With slices,
load `conversation.js` for generated-view empty/loading/error and action messages, plus the
families and `shared.js` used by the generated controls. Gen keeps English fallbacks locally;
translations still use the matching **Lyra UI** package version. Registered messages update mounted
views, while `.strings` can override renderer copy per instance. Generated prose and caller labels
are application content and are not translated by these catalogs. Locale selection does not set
text direction: set an inherited `dir` for RTL content.

To load catalogs lazily instead, use `loadLyraLocale()` from `@aceshooting/lyra-ui/locale-loader.js`;
it imports from this package.

Upgrading from lyra-ui 26 or earlier: see the [upgrade table](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/README.md#upgrading).

## Versioning

This package is versioned together with `@aceshooting/lyra-ui`; use matching versions.

MIT licensed.
