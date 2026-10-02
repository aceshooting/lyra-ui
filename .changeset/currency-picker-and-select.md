---
'@aceshooting/lyra-ui': minor
---

Add `lr-currency-picker`, a form-associated currency selector with localized names and symbols,
an optional ordered catalog, and a compact ISO-code trigger. The control follows shared keyboard,
validation, localization and styling contracts without fetching exchange rates or changing the
page locale. Its opt-in search matches codes, localized names and symbols, and catalogs support
caller-defined groups. Registration-free currency helpers expose the complete ISO catalog and
validate, load and convert explicit rate snapshots with caller-owned providers and cancellation.

Add country, time-zone and measurement-unit pickers with configurable catalogs, optional search,
native form contracts and consistent field styling. Country choices include localized names and
optional decorative flags. Add optional text filtering to the language picker while preserving its
locale loading, veto and selection behavior.

Match the form mixin's public reset-default setter type to its existing nullable runtime input,
while preserving the non-nullable read type and dirty live values.

Avoid marking a selected `lr-select` value as unavailable before its slotted options have been
collected, including during server rendering. Keep its dropdown within the available screen height
and width when text is enlarged, and scroll keyboard-highlighted options into view within the
listbox. Document the existing rendered `data-value` hooks and `chooseOption()` test driver for
selecting options by value.
