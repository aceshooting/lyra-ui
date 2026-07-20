---
"@aceshooting/lyra-ui": minor
---

`<lr-split>`: `rail-breakpoint` and `float-breakpoint` now accept a CSS length (`'640px'`,
`'68.75rem'`, `'3em'`) as well as the original bare pixel number, and a new
`collapse-breakpoint-basis="viewport"` measures both against the viewport via `matchMedia` instead
of the split's own `[part="base"]` allocation — for collapsing in step with a page-level `@media`
layout. Both thresholds are classified together on every change, so a fast resize crossing both at
once still lands on one correct state and fires `lr-split-collapse-change` once; under viewport
basis the first paint already carries the right `data-collapse-state` with no `ResizeObserver`
round-trip, and that initial state is not announced as a transition. Note `(max-width:)` is
inclusive while container basis compares strictly `<`, so switching basis shifts each crossing
point by 1px. An unparseable length (`'80vw'`, `'calc(…)'`, garbage) falls back to the documented
`640`/`400` defaults rather than switching collapse off, and the "rail must sit above float"
invariant is still enforced, in pixel space, under both bases.

Because both properties now accept a string, they use Lit's default string converter: reading
`el.railBreakpoint` after `rail-breakpoint="640"` returns `'640'` rather than `640` (matching how
`orientationBreakpoint` already behaves). Authored values and crossing behavior are unchanged.
