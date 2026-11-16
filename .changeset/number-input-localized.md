---
'@aceshooting/lyra-ui': minor
---

`lr-number-input` gains an opt-in `localized` attribute for locale-aware entry. The field then reads and shows numbers with the grouping and decimal separators of the effective locale (`25.000` and `10,24` in `de` or `ro`), while `value`, the submitted form value and `valueAsNumber` keep the native number form (`25000`, `10.24`). Range, step and required validity still come from the platform, grouping is checked so an entry the locale would not write reports `badInput` instead of being misread, and the text field keeps spinbutton semantics and ArrowUp/ArrowDown stepping. Existing fields are unchanged: without `localized` the component stays a native `type="number"` input with the same defaults.
