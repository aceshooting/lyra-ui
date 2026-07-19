---
"@aceshooting/lyra-ui": minor
---

`<lr-stepper>` gains `orientationBreakpointBasis` (`"container"` by default, `"viewport"`
opt-in), selecting whether `orientationBreakpoint` is compared against the stepper's own
measured inline size or a `matchMedia('(max-width: …)')` query. Viewport basis is the only
way a stepper with a fixed width in a row layout can react to that row stacking at a shared
breakpoint. Left unset, behavior is unchanged.
