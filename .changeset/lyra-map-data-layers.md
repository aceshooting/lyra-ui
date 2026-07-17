---
"@aceshooting/lyra-ui": minor
---

`lyra-map` gains a `dataLayers: GeoJsonDataLayer[]` property: each entry adds a GeoJSON source plus
fill/line/circle layers (colored from `--lyra-*` tokens by an optional `tone`), independent of the
existing `choropleth` prop (which requires `field`/`stops` and can't display plain geometry). Defaults
to an empty array — zero behavior change for existing `lyra-map` users. This is the enabler for the
upcoming GeoJSON-file document-viewer bridge, and is useful standalone for rendering arbitrary
GeoJSON shapes (routes, zones, points of interest) without hand-building maplibre-gl layers.
