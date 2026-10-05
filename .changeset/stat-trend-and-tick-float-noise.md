---
'@aceshooting/lyra-ui': patch
---

`lr-stat` no longer prints float noise in a fractional trend: `delta-percent="384.9"` rendered `384.89999999999998%` and now renders `384.9%`. `lr-lite-chart` snaps its value-axis bounds and ticks to the step grid, so a custom `tickFormat` or `formatter` receives `0.3` instead of `0.30000000000000004`.
