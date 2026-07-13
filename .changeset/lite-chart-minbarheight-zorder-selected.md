---
"@aceshooting/lyra-ui": minor
---

Fix `lyra-lite-chart`'s `minBarHeight` z-order bug for stacked bars: a floored near-zero segment
was being overdrawn by the segment stacked on top of it, since each segment's position was derived
independently from cumulative value rather than from where the previous (possibly-floored) segment
actually ended on screen. Also add `selectedIndex: number[]`, reflecting `data-selected` onto every
bar at a given category index across all datasets, for highlighting a whole selected column.
