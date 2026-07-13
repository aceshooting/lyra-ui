---
"@aceshooting/lyra-ui": minor
---

`lyra-split` now redistributes the track space freed when a `panelConstraints` pixel bound clamps a
panel's percentage basis down (e.g. a `maxPx` cap on a wide viewport) to sibling panels that have no
pixel constraint of their own, instead of leaving that space unused. No behavior change for splits
without `panelConstraints`, or where no panel is actually clamped this render.
