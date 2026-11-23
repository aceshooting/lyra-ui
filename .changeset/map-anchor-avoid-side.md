---
'@aceshooting/lyra-ui': minor
---

`lr-map` gains `anchorAvoidSides`, a list of `{ element, side }` obstacles that keeps anchors on a
named side of each: `'block-end'` (below it), `'block-start'`, `'inline-start'` or `'inline-end'`
(logical, so they follow RTL), or `'auto'`, the cheapest edge that `anchorAvoid` uses. Use it for
chrome whose cheapest edge changes with its size, such as a floating search bar whose results list
opens and would otherwise squeeze the anchored panel into a narrow column beside it. An element in
both `anchorAvoid` and `anchorAvoidSides` takes its side from the latter; `anchorAvoid` itself is
unchanged. The new `LyraMapAnchorAvoidObstacle` and `LyraMapAnchorAvoidSide` types are exported.
`anchorAvoid`, `anchorAvoidSides` and `controlsAvoid` also no longer reserve space for an obstacle
hidden with `visibility: hidden` (including an inherited one), and re-measure when an obstacle's own
`style`, `class` or `hidden` attribute changes.
