---
'@aceshooting/lyra-ui': minor
---

The optional `chartjs-plugin-zoom` peer now accepts `^2.0.0 || ^3.0.0`. Charts with `zoomable` work
with the 3.x line, which recognizes pan and pinch gestures from native pointer events and no longer
installs `hammerjs`; existing 2.x installations keep working unchanged.
