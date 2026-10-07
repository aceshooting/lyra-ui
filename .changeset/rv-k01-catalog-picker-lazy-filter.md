---
"@aceshooting/lyra-ui": patch
---
The country, time-zone, unit and currency pickers no longer bundle `lr-combobox` for non-searchable use; it loads the first time `searchable` is enabled, and `await picker.updateComplete` waits for it.
