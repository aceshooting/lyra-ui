---
"@aceshooting/lyra-ui": patch
---

`lr-map` now paints a marker with an omitted `color` in the themed `--lr-color-brand` token, matching the GeoJSON data-layer default, instead of maplibre-gl's own hardcoded `#3FB1CE`. An explicit invalid color (or a `url()` paint server) still falls through to maplibre-gl's own default, unchanged.
