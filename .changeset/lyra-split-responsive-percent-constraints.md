---
"@aceshooting/lyra-ui": minor
---

Added `defaultSizes` to `lr-split` for an initialization-only fallback (a valid restored
`storageKey` layout still wins, then `defaultSizes`, then equal distribution) that's never
overwritten by a later reactive parent render. Added an opt-in `orientationBreakpoint`/
`narrowOrientation` responsive-axis contract (mirrored below by `lr-stepper`): below the
component's own measured inline size, `narrowOrientation` becomes the effective resize axis
instead of the authored `orientation`, exposed via `effectiveOrientation`, a
`data-effective-orientation` attribute, and `lr-split-orientation-change`. Extended
`panelConstraints` with `minPercent`/`maxPercent`, combining with `minPx`/`maxPx` on the same side
via the stricter bound.
