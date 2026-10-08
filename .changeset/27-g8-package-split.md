---
'@aceshooting/lyra-ui': major
---

The editor data and the built-in locale catalogs moved out of `@aceshooting/lyra-ui` into two companion packages, cutting the install from about 35 MB to about 20 MB unpacked.

- Locales: install `@aceshooting/lyra-translations` and change `@aceshooting/lyra-ui/translations/<locale>.js` (and `<locale>/<family>.js`) to `@aceshooting/lyra-translations/<locale>.js`. The package is an optional peer of `@aceshooting/lyra-ui`; `loadLyraLocale()` from `@aceshooting/lyra-ui/locale-loader.js` now imports its catalogs from it, so install it wherever that loader is used. The pseudo-locales (`@aceshooting/lyra-ui/translations/pseudo/en-XA.js` and `ar-XB.js`) stay in `@aceshooting/lyra-ui`. `locales.json` now lists the new specifiers.
- Editor data: install `@aceshooting/lyra-ide` for `custom-elements.json`, `web-types.json`, `vscode-html-data.json` and `vscode-css-data.json`. Change `@aceshooting/lyra-ui/custom-elements.json` to `@aceshooting/lyra-ide/custom-elements.json` and the VS Code `html.customData` / `css.customData` paths to `./node_modules/@aceshooting/lyra-ide/...`. `@aceshooting/lyra-ui` no longer has the `customElements` and `web-types` package fields or the `./custom-elements.json` export.

The three packages are versioned together.
