---
'@aceshooting/lyra-ui': patch
---

Panorama camera keys, hierarchy navigation and column resize no longer act on Ctrl/Alt/Meta shortcuts or IME composition.
Status labels no longer throw or resolve inherited names for non-string or `constructor`-style statuses.
Roving focus targets under a hidden or inert host across a shadow boundary are now skipped.
Model and voice pickers no longer re-emit input and change when the current value is re-selected, and emit `change` events in the same order as the other selectors.
Separator and column-resize drags no longer throw when pointer capture is unavailable.
Numeric values interpolated into localized messages use the active locale's numerals.
Catalog pickers filter accent-insensitively.
