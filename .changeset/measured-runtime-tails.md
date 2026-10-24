---
'@aceshooting/lyra-ui': patch
---

Retain the mixed runtime observations from comparisons with 30.0.0. Earlier controlled published/current/current/published measurements did not consistently reproduce the initial chart and combobox total-time increases, although three of four comparisons still flagged smaller wait-related metrics. A fresh complete quick Chromium comparison with matched metadata and dependencies reports 11 regressed and 7 improved timing metrics out of 150. Chart total p95 rises from 111.8 to 147.9 ms; table-sort update median rises from 11.5 to 13.7 ms. Additional regressions affect table no-op frame waits and select metadata-update p95. These observed regressions do not establish a performance pass.

The table's runtime import graph is unchanged. The chart's new late-feature request checks run during untimed setup, with those features disabled in the fixture. Select changes concern initial selection and reset behavior, while positioning changes affect open popups, outside the measured closed-control metadata updates. No changed algorithmic cause was identified for these operations. With seven samples, p95 is the maximum; phase timings include scheduling and frame waits. Those limits do not erase the observations. The deterministic scale checks and the separately required A/B benchmark retain their existing thresholds.
