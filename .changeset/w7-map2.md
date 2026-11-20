---
'@aceshooting/lyra-ui': major
---

- `lr-map` loads the projection code for `dataLayers` and `choropleth` (descriptor model, vector-style admission and GeoJSON projection) only when one of them is set, cutting about 27 KB from the map's first-paint chunk. Until that runtime arrives the derived choropleth legend, the data extent and generated layers are absent; `updateComplete`, `whenStyleReady()` and `whenIdle()` wait for it, and an unloadable runtime shows the localized configuration error. Migration: code that reads data-layer state synchronously right after assigning `dataLayers` or `choropleth` should `await el.updateComplete` first.
