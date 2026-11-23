---
'@aceshooting/lyra-ui': minor
---

`lr-map`'s `anchorAvoid` entries can now be `{ element, side }` to name the side of an obstacle
that anchors stay on: `'block-end'` (below it), `'block-start'`, `'inline-start'` or `'inline-end'`
(logical, so they follow RTL), or `'auto'`, today's cheapest-edge behavior and still the default for
a plain element. Use it for chrome whose cheapest edge changes with its size, such as a floating
search bar whose results list opens and would otherwise squeeze the anchored panel into a narrow
column beside it. The new `LyraMapAnchorAvoidEntry`, `LyraMapAnchorAvoidObstacle` and
`LyraMapAnchorAvoidSide` types are exported. `anchorAvoid` and `controlsAvoid` also no longer
reserve space for an obstacle hidden with `visibility: hidden` (including an inherited one), and
re-measure when an obstacle's own `style`, `class` or `hidden` attribute changes.
