---
"@aceshooting/lyra-ui": patch
---

Paint the horizontal edge fade only while the track actually overflows, in `<lr-segmented>`,
`<lr-tabs>`, `<lr-stepper>`, and `<lr-timeline>`. All four applied their `--lr-scroll-fade-size`
`mask-image` unconditionally, described in-code as an intentionally static, observer-free
affordance. That is only harmless when there *is* overflow. On a track that fits, the fade is pure
damage: at the `2rem`-per-edge default a two-option `<lr-segmented>` (`Overall | Daily`) is
narrower than its own two fades, so both labels rendered half-transparent and the control read as
permanently disabled; a short `<lr-tabs>` row dimmed its first and last tab for no reason.

A new internal `ScrollOverflowController` measures `scrollWidth` vs `clientWidth` and toggles a
`data-scroll-overflow` attribute on the track (inside the shadow root — not consumer-visible DOM),
which now gates each mask rule. It re-measures from two sources, because they catch different
changes: a `ResizeObserver` on the track for container resizes, and the host's own update cycle for
content changes, which need not alter the track's border box at all. Overflowing tracks keep
exactly their previous rendering.

Note for anyone spying on `ResizeObserver` construction: `<lr-stepper>` now arms one of its own
regardless of the `orientationBreakpoint` feature.
