---
'@aceshooting/lyra-ui': patch
---

Document how `lr-dialog` and `lr-drawer` panels paint when no surface is chosen: they follow the built-in profile's Glass, a 60% fill over a 12px backdrop blur held on an internal layer, so `getComputedStyle(panel).backdropFilter` reads `none` while the backdrop is still blurred. Tests now pin that a translucent panel always carries the blur and that `data-lr-surface="solid"` paints it opaque without one. Rendering is unchanged.
