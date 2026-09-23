---
'@aceshooting/lyra-ui': patch
---

Fix `lr-map` point icons rasterizing solid black when a data layer's `point.iconColor` was set to a color the browser couldn't parse; it now falls back to the layer's theme-appropriate tone color instead, matching every other color the component resolves.
