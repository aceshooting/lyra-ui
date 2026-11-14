---
'@aceshooting/lyra-ui': patch
---

Restore release performance comparisons after Playwright upgrades by matching ChromeDriver to the configured Chromium version. Install the pinned benchmark tools in a fresh cache for each run so an older driver cannot be reused. The three workloads and the 10% regression threshold are unchanged.
