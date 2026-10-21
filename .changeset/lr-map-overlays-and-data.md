---
'@aceshooting/lyra-ui': minor
---

`lr-map` overlays and data.

- `anchor` slot positioned at `anchorLngLat`: follows the camera, flips and shifts to stay inside the map, hidden while the point is off screen.
- `choropleth.noData` (`color`, `strokeColor`, `label`): features without a numeric value paint with it, and a click on one reports `noData: true` in the `lr-map-click` detail.
- `choroplethLegend` derives the legend from the choropleth (step bands, or a gradient bar with ticks, plus a no-data swatch); `legendGradientTicks` adds labelled marks to the gradient bar.
- `cluster.zoomOnClick` eases into a clicked cluster.
- Declarative `controls` (`navigation`, `scale` with a corner and a scale `unit`); button names follow `lang` changes live.
- `LYRA_MAP_EMPTY_STYLE`, a frozen basemap-free style.
- `maxBounds` now applies at a fractional zoom below 1 instead of being dropped.
- The `immutable-collections` migration rule reports `lr-map` `center` assignments for review (`MAP_CENTER_REVIEW`), and the v29 → v30 guide has a Map section.
