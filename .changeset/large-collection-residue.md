---
'@aceshooting/lyra-ui': patch
---

Reduce remaining large-collection costs.

- `lr-tool-timeline` keeps the processed form of every unchanged call when a replaced collection appends or updates a few calls, instead of rebuilding all retained calls.
- Currency and unit pickers resolve a new locale's names and symbols without evicting number formatters other components share.
- Theme-aware components no longer receive style and class mutations from inside their own shadow root, such as map marker movement, unless a nested theme-aware component needs them.

These changes add up to 128 gzip bytes to the complete registration, family barrels, root entry and scoped-registry loader route, and 295 raw bytes to the packed core bundle. Only the breached size ceilings advance, each to the next 64-byte boundary above its measurement (raw core: 40 bytes of headroom).
