---
'@aceshooting/lyra-ui': patch
---

Keep icon-library changes made during a mutator from being overwritten by its retired load. Show a localized error when an active icon request aborts unexpectedly, while keeping replaced and disconnected requests silent.

The corrected shared icon load path changes bundle compression. Measured media aggregate and popup/export-button marginal gzip sizes exceed their previous canaries by 4, 4, and 2 bytes; only those ceilings move to the next 64-byte boundary.
