---
"@aceshooting/lyra-ui": minor
---

`<lr-map>`: render a continuous choropleth legend, via a new `legendGradient` property and a
`legend` slot.

`choropleth` builds an interpolated fill expression from `stops` — a continuous ramp — but `legend`
accepted only `{ color, label, pattern }` rows rendered as discrete swatches, and the component
exposed no slots. The standard key for a choropleth (a gradient bar with endpoint ticks) could not
be rendered inside the component that produces the gradient, so a consumer had to draw a second,
unaligned legend outside the map and keep its stops manually in sync with the layer's.

- `legendGradient: readonly (readonly [number, string])[]` takes the same `[value, color]` shape as
  `choropleth.stops`, so the usual assignment is `map.legendGradient = myChoropleth.stops` and the
  key cannot drift from the layer it describes. Stops are sorted ascending, bounded to 64, and
  filtered to finite values with a CSS-parsable color; fewer than two usable stops render no bar,
  since a one-stop "gradient" is a flat block that describes nothing. Each stop sits at its true
  proportion of the value range rather than being evenly spaced.
- `legendGradientLoLabel` / `legendGradientHiLabel` override the endpoint captions, which otherwise
  default to the lowest/highest stop value in the component's own locale-aware formatting.
- New `legend-gradient`, `legend-lo` and `legend-hi` parts, named to mirror `lr-heatmap`'s gradient
  legend as the request asked, so one styling vocabulary covers both. The bar is `aria-hidden` and
  `inert`; the captions carry the meaning. It mirrors under RTL like the heatmap's does.
- A new `legend` slot renders custom legend content inside the panel's own layout, so it stays
  positioned with the map. Supplying it opens the panel even when both legend inputs are empty.

All additive: with none of them set the component renders exactly as before, covered by an explicit
unset test.
