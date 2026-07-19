---
"@aceshooting/lyra-ui": minor
---

`<lr-split>` gains `orientationBreakpointBasis` (`"container"` by default, `"viewport"`
opt-in), selecting whether `orientationBreakpoint` is compared against the component's own
measured inline size or a `matchMedia('(max-width: …)')` query. Viewport basis lets sibling
components in one row flip orientation together at a single shared breakpoint — impossible
to express with a self-measured threshold when the row stacks via a CSS `@media` rule — and
lets the browser resolve a `rem` breakpoint with real media-query semantics. Left unset,
behavior is unchanged.
