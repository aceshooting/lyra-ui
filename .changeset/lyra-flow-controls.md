---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-flow-controls>`: the zoom in/out, fit, and interaction-lock button cluster for
`lyra-flow-canvas`, so every flow surface ships the same affordances without hosts rebuilding them.
Zoom buttons disable at the resolved canvas's `minZoom`/`maxZoom` bounds; the lock toggle stays in
sync with the canvas's `locked` attribute regardless of what changed it.
