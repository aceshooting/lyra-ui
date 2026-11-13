---
'@aceshooting/lyra-ui': patch
---

Clamp out-of-range color percentages before conversion so very large finite RGB values retain the saturated channel instead of turning black.
