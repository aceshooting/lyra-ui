---
'@aceshooting/lyra-ui': minor
---

Closed mobile app-rail panels park one pixel beyond the edge, preventing fractional-width background slivers. Slides run only for real opening and closing, so direction changes and entry into mobile mode cannot sweep a closed panel across the page. Open-only elevation is customizable with `--lr-app-rail-panel-shadow`; closed content stays inert.
