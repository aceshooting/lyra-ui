---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains `dimmedNodeIds`/`dimmedLinkIds` (controlled, mirroring
`selectedNodeIds`/`selectedLinkIds`): a host can now apply a themeable low-opacity treatment to
arbitrary nodes/links -- e.g. dimming every non-neighbor of a hovered node -- via a new
`--lyra-graph-dimmed-opacity` custom property, in both the `svg` (default) and `canvas` renderers.
Previously the only way to express this was reaching into the shadow DOM; `1` (no-op) by default,
so existing usage is unaffected.
