---
"@aceshooting/lyra-ui": minor
---

Added an opt-in `orientationBreakpoint`/`narrowOrientation` responsive-axis contract to
`lr-stepper`, mirroring `lr-split`'s identically-named properties: below the stepper's own
measured inline size, `narrowOrientation` becomes the effective layout/navigation axis instead of
the authored `orientation`, exposed via `effectiveOrientation`, a `data-effective-orientation`
attribute, and `lr-stepper-orientation-change`. Unset (the default), behavior is unchanged.
