---
"@aceshooting/lyra-ui": minor
---

`lyra-heatmap`: add a `cellInteractive` predicate to opt individual cells out of hit-testing and
keyboard roving focus, and a `colorSteps` discrete-array ramp as an alternative to the 2-endpoint
`--lyra-heatmap-scale-lo`/`-hi` linear interpolation (governs both `mode`s and both `scale`
values). Also adds test coverage confirming `firstDayOfWeek`'s calendar-mode weekday-axis labels
are correct for a non-Sunday-first week (the underlying computation was already correct; only the
test combining the two was missing).
