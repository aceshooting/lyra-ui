---
'@aceshooting/lyra-ui': patch
---

Preserve scoped theme ownership when an element is frozen after its first theme application, so later theme changes still restore the original attributes and token values when the scope is removed.

The theme entry measures 13,514 gzip bytes with the ownership correction. Its reviewed ceiling advances to 13,568 bytes, the next 64-byte boundary. Other entry budgets remain unchanged.
