---
"@aceshooting/lyra-ui": minor
---

Added a frame-coalesced `lr-viewport-change` event to `lr-graph`, firing at most once per
animation frame for every source that can move a rendered node's screen position (pan/zoom, a
`focusNode()`/`fit()` tween, or a simulation tick) so a consumer anchoring its own UI to a node's
`getBoundingClientRect()` no longer needs to poll its own `requestAnimationFrame` loop.
`--lr-graph-dimmed-opacity` now defaults to `0.35` (previously the inert `1`), so `dimmedNodeIds`/
`dimmedLinkIds` are visible out of the box with no host styling required.

`lr-knowledge-graph-explorer` now computes and forwards `dimmedLinkIds` alongside
`dimmedNodeIds`, switched its details-popover pan/zoom tracking from RAF polling to the new
`lr-viewport-change` event, and added a `highlight: 'selection' | 'hover' | 'none' = 'selection'`
property: `'hover'` also dims by the currently pointer-hovered node's neighborhood, `'none'` opts
a host out of this component's own dimming entirely.
