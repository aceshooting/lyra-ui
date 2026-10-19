---
'@aceshooting/lyra-ui': minor
---

Add four regional locale catalogs as small difference catalogs: `en-GB` (British English, over the built-in English), `es-419` (Latin American Spanish, over `es`), `fr-CA` (Canadian French, over `fr`) and `zh-HK` (Hong Kong Traditional Chinese, over `zh-TW`). Each registers only the messages that differ for the region and resolves every other message through its parent, so importing one also loads its parent catalog. They ship in `@aceshooting/lyra-translations` as `en-GB.js`, `es-419.js`, `fr-CA.js` and `zh-HK.js` (plus per-family slices), appear in `locales.json` and the optional locale loader, and are recorded as AI-assisted reviews with no human or native-speaker claim. An exact `zh-HK` tag now selects the `zh-HK` catalog instead of falling back to `zh-TW`.
