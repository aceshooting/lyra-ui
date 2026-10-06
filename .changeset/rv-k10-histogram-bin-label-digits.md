---
"@aceshooting/lyra-ui": major
---
`binValues()` and lr-histogram: bucket range labels no longer always use exactly one decimal place. Each bound now shows two significant digits of the bin width — no fraction digits once the width reaches 10, never a forced trailing zero — so narrow ranges stay distinct (`0.011–0.0148` instead of several identical `0.0–0.0` labels) and large ones lose the spurious `.0` (`1,000,000–1,100,000`); a constant domain shows its value with three significant digits. Migration: if you match, parse or snapshot these label strings (bucket `label`, `lr-point-activate`/`lr-datum-activate` `label`, CSV export), update the expected text, or format the bounds yourself from your own bin edges.
