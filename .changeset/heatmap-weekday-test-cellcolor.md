---
"@aceshooting/lyra-ui": minor
---

Rewrite `lyra-heatmap`'s two weekday-axis-label tests to assert against independently fixed dates
instead of re-deriving the implementation's own formula, which could never fail regardless of
correctness -- the underlying `weekdayLabels()`/`firstDayOfWeek` anchoring was already correct.
Also add `cellColor`, an optional per-cell color override function (mirroring the existing
`cellText`/`cellInteractive` shape) that bypasses the color ramp entirely for an exact value.
