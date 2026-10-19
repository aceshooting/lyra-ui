---
'@aceshooting/lyra-ui': patch
---

Reduce remaining large-collection costs.

- `lr-tool-timeline` keeps the processed form of every unchanged call when a replaced collection appends or updates a few calls, instead of rebuilding all retained calls.
- Currency and unit pickers resolve a new locale's names and symbols without evicting number formatters other components share.
- Theme-aware components no longer receive style and class mutations from inside their own shadow root, such as map marker movement, unless a nested theme-aware component needs them.
