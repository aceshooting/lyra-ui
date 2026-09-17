---
"@aceshooting/lyra-ui": minor
---

`<lr-map>`: add a `legend-start` slot that renders at the top of the legend panel.

The panel's only host extension point was `slot="legend"`, which renders after the gradient bar and
every projected row — so a host-authored panel header (a title, a source note, a control) could only
ever be a footer. `legend-start` renders ahead of both. Content in it alone opens the panel, exactly
as `legend` content alone already did, and it is never made interactive by `legendInteractive`. The
existing `legend` slot keeps its position, so an unset map's legend markup is unchanged.
