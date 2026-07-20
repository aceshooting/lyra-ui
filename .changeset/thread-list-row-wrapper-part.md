---
"@aceshooting/lyra-ui": minor
---

`lr-thread-list` exposes a `row-wrapper` CSS part around `wrapRow` output.

`wrapRow` was the one row hook with no library-added part -- `renderLeading`, `renderRowContent`,
`renderMeta` and `renderActions` each get a `row-*` wrapper, so a host wrapping a whole row had to
thread its own class through the callback to lay it out. Its return value is now placed inside a
`part="row-wrapper"` block `<div>`, reachable from outside as `lr-thread-list::part(row-wrapper)`.

The wrapper is deliberately unstyled and block-level, and is added only when `wrapRow` is set: the
box the internal `lr-virtual-list` measures for windowing is its own `[part="row"]` one level up,
and an unstyled block box contributes exactly its child's height to it, so measured row heights are
unchanged. The part is row-only -- group headers never pass through `wrapRow` and never carry it.
