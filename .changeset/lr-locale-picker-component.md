---
"@aceshooting/lyra-ui": minor
---

Add `<lr-locale-picker>`: a closed-list locale switcher over the locale registry
(`getRegisteredLyraLocales()`) or an explicit `locales` catalog, form-associated and mirroring
`<lr-select>`'s hand-rolled listbox. Selecting a row emits a cancelable `lr-change` and, unless
vetoed, applies the pick via `setLyraLocale()`.
