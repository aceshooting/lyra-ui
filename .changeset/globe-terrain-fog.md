---
"@aceshooting/lyra-map": patch
---

Avoid requesting an unsupported fog matrix when drawing globe terrain. Globe terrain continues to render without fog, while Mercator terrain retains its existing fog calculation.
