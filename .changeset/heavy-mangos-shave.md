---
"@aceshooting/lyra-ui": minor
---

`lr-stepper`'s `orientation-breakpoint` now accepts a CSS length, not only a bare pixel number:
`500`, `'500'`, `'500px'`, `'31.25rem'` and `'3em'` are all valid, and equal computed values behave
identically.

`rem` resolves against the **document root**'s computed font size — exactly as a `rem` in a CSS
`@media` query does, and deliberately *not* against the stepper itself — so a breakpoint authored in
`rem` stays numerically in step with the sibling `@media (max-width: …rem)` rule it has to agree
with, instead of silently drifting from it when the root font size changes (browser zoom, a user
font-size preference, an app base-size token). `em` resolves against the stepper's own computed font
size. The length is re-resolved on every measurement and never cached, so those changes are picked
up without any invalidation step on the consumer's side.

A value that isn't a usable length — `%`, `vw`, `calc()`, `'auto'`, an unparseable string — now
behaves exactly as unset: no `ResizeObserver` is armed and no `data-effective-orientation` attribute
appears, rather than arming a breakpoint that can never be crossed. For a viewport-relative
breakpoint, leave `orientationBreakpoint` unset and drive `orientation` from your own `matchMedia()`
controller; `orientationBreakpoint` measures the stepper's own allocated inline size, not the
viewport.

The property's TypeScript type widens from `number | undefined` to `number | string | undefined`,
and the `orientation-breakpoint` attribute is no longer coerced through Lit's `Number` converter.
Every existing numeric usage — attribute or property — is unaffected. This mirrors the identical
change to `lr-split`, whose `orientationBreakpoint`/`narrowOrientation` contract `lr-stepper`
deliberately shares.
