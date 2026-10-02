---
'@aceshooting/lyra-ui': minor
---

Add `lr-currency-picker`, a form-associated currency selector with localized names and symbols,
an optional ordered catalog, and a compact ISO-code trigger. The control follows shared keyboard,
validation, localization and styling contracts without fetching exchange rates or changing the
page locale.

Avoid marking a selected `lr-select` value as unavailable before its slotted options have been
collected, including during server rendering. Keep its dropdown within the available screen height
and width when text is enlarged, and scroll keyboard-highlighted options into view within the
listbox. Document the existing rendered `data-value` hooks and `chooseOption()` test driver for
selecting options by value.
