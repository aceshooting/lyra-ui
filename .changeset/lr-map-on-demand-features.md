---
'@aceshooting/lyra-ui': minor
---

`lr-map` loads drawing, image export, URL hash ownership, owned resources, images, style overrides, anchors, controls and feature state on demand, cutting its initial download by about a quarter. Calls made while a feature loads return `false`; await `whenIdle()` and call again.
