---
"@aceshooting/lyra-ui": minor
---

Add `type: 'custom'` filters to `lr-filter-bar`, letting a filter definition supply its own renderer and value adapter so any existing Lyra control (`lr-checkbox`, `lr-time-range`, an async `lr-combobox`, ...) can participate in the same controlled `value`, active-chip, reset, disabled, and validation contract as the built-in filter types.
