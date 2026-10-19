---
'@aceshooting/lyra-ui': patch
---

The `lr-map` guide now documents that, on WebKit, a paint change made directly on the `map` engine instance can stay unpresented until another frame is requested (a MapLibre and WebKit behavior, reproducible without `lr-map`), and that calling the engine's `triggerRepaint()` once afterwards presents it.
