---
"@aceshooting/lyra-ui": minor
---

`<lr-map>` gains a `'step'` choropleth interpolation and independent fill/stroke colours on
`dataLayers` — the two declarative gaps that stopped an application migrating off a first-party
MapLibre wrapper after every other property already matched.

**`interpolation: 'step'`** emits maplibre's `['step', …]` instead of `['interpolate', …]`, giving
discrete bands rather than a continuous ramp. A ramp is wrong whenever the legend advertises a fixed
set of ranges with one swatch each: it puts colours on the map that appear nowhere in the legend and
renders two regions in the same advertised band as visibly different colours. `stepBaseColor` sets
the colour below the first threshold (which `['step', …]` requires) and defaults to the first stop's
own colour.

**`dataLayers[].color` / `.strokeColor`** override `tone` for the fill and for the line/circle
layers respectively, falling back to `color` and then `tone`. They are separable because a fill and
its outline want opposite things on a choropleth-plus-overlay map: the fill competes for area and
must sit quiet, while the 1px outline competes with nothing and is the only thing keeping a no-data
region's shape readable once the fill is that faint. Deriving one from the other measured 1.41:1
against a light basemap, under WCAG 1.4.11's 3:1 floor for graphical objects. A `var(--lr-…)`
reference is resolved against the host first, since MapLibre paints to a WebGL canvas and never sees
the CSS cascade.

Both are additive: an unset `interpolation` still interpolates linearly, and a `tone`-only data
layer paints exactly as before.
