---
'@aceshooting/lyra-ui': minor
---

`lr-map` renders large styled GeoJSON through `overlays`: a `geojson` source's `Feature` or `FeatureCollection` `data` object is kept by identity, outside the overlay value budget, so data of any size keeps native paint and layout expressions, filters, `minzoom`/`maxzoom`, symbol layers, `before` ordering, interaction and feature state across `mapStyle` swaps. A new data object updates the native source in place with `setData`, and `updateSourceData()` accepts overlay GeoJSON source IDs. Hits now skip a layer outside its zoom range at the fractional camera zoom, hidden, or with every opacity known to be `0`, so a hidden tier never shadows a visible one.
