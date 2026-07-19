---
"@aceshooting/lyra-ui": minor
---

`<lr-split>`'s `orientationBreakpoint` now accepts a CSS length string as well as a bare pixel
number, so it can be authored in the same unit as the sibling CSS `@media` rule it has to agree
with.

Accepted forms: `900` / `orientation-breakpoint="900"` (unchanged), `'900px'`, `'56.25rem'`, and
`'3em'`. `rem` resolves against the **document root**'s font size — exactly as a `rem` in a CSS
`@media` query does, not against the element — so a breakpoint written to match
`@media (max-width: 56.25rem)` stays in sync with it across browser zoom, a user font-size
preference, or an app-level base-size change. `em` resolves against the split's own computed font
size. The length is re-resolved on **every** measurement rather than cached at first render, so a
root font-size change moves the crossing width with no invalidation step.

Anything that isn't a resolvable length now behaves exactly as unset — no `ResizeObserver`, no
`data-effective-orientation` marker — where before, a non-numeric attribute became `NaN` and armed
observation for a threshold that could never be crossed. That deliberately includes `%`, `vw`/`vh`
and `calc()`, which would mix a viewport-relative threshold into a measurement of the element's own
allocation; drive `orientation` from your own `matchMedia()` controller for a viewport-relative
breakpoint instead.

One visible consequence of dropping the `Number` attribute converter: reading `.orientationBreakpoint`
back after setting the attribute now returns the authored string (`'900'`), not the number `900`.
The resulting layout behavior is identical, and the property type is now `number | string`.
