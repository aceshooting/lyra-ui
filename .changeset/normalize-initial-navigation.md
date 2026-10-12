---
'@aceshooting/lyra-ui': patch
---

Normalize a navigation item's initial open state when its panel is removed before the first render, without emitting a toggle for a panel that was never shown.

Preserve the inherited lifecycle API and focus repair ordering by normalizing after slot presence refresh. The five affected bundle ceilings record the measured correctness fix with no added allowance; the complete bundle grows by 40 gzip bytes.
