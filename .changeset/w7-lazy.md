---
'@aceshooting/lyra-ui': major
'@aceshooting/lyra-translations': major
---

Load optional composed controls on first use and publish smaller locale catalogs.

- `lr-filter-bar`'s default entry registers each filter type's control (`lr-select`, `lr-combobox`, `lr-option`, `lr-date-input`, `lr-input`, `lr-dropdown`, `lr-dropdown-item`) and the `loading` spinner the first time a bar renders it. `lr-prompt-input` does the same for `lr-model-select`, `lr-voice-picker`, `lr-source-picker` and `lr-prompt-queue`, and `lr-document-library` for its tag facet's `lr-combobox`. Each control upgrades in place, and the host's `updateComplete` waits for the registrations its render started. The `components/layout` family barrel still registers every filter control up front.
- `@aceshooting/lyra-translations` omits a message whose text equals the English default when the locale's lookup falls straight back to English (a catalog without a parent locale that shares its base language with no other shipped catalog, and the regional deltas built on it). Rendered text is unchanged; development builds do not report these messages as missing.

Migration:

- Code that reads `customElements.get('lr-combobox')` (or any control listed above) right after importing only `lr-filter-bar.js`, `lr-prompt-input.js` or `lr-document-library.js` must import that control's own `components/lr-*.js` entry, or await the host's `updateComplete` after it renders the control. `filter-bar-register.js` and `prompt-input-register.js` still register nothing on demand.
- For those locales, an application-registered `en` catalog (or an application-registered standalone catalog sharing the locale's base language, such as `fr-BE`) now also answers the omitted messages, `getRegisteredLyraLocaleKeys()` no longer lists them, and a `resolveLyraString()` call without its `defaults` argument returns the key for them. Register the locale's own override with `registerLyraLocale()` to pin a message, and pass the component's `defaultStrings` as `defaults`.
