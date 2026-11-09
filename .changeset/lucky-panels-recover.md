---
'@aceshooting/lyra-ui': patch
---

Recover an invalid multi-split hydration count from the actual panel membership before computing divider geometry. Non-finite, negative, fractional, and unsafe integer counts no longer interrupt rendering or hide existing dividers.
