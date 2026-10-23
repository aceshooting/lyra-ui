---
'@aceshooting/lyra-ui': minor
---

`lr-map` covers more of what map applications build by hand:

- `initialization="interaction"` builds the map on the first press, touch, wheel or key on the element, behind a localized `initialization-activate` button; `initializationDelay` also builds it after a delay.
- Overlay layer paint and `styleOverrides` accept theme tokens, `currentColor` and CSS color functions, converted to sRGB and re-resolved when the theme changes. Overlay layers may target a source of the basemap style.
- `lr-map-geolocate` reports `{ lngLat, accuracy }` after the user-activated geolocate control locates the user.
- Drawing closes a polygon from a press on its first vertex, shows a rubber band to the pointer, offers localized on-map measurements (`drawingMeasurements`), completes on Enter and undoes on Backspace while the map has focus, survives a `mapStyle` swap, reports `lr-map-draw-vertex-end` when a vertex drag ends, and takes its color from `--lr-map-drawing-color`. A vertex drag now follows every pointer move instead of stopping after the first.
- `lr-map-pointer-move` and `lr-map-pointer-leave` report the pointer position once per frame, and hover, context-menu and pick events carry the hit as a frozen GeoJSON `feature` with geometry.
- `interactiveBasemapLayers` and `styleOverrides` select basemap layers by `source`, `sourceLayer` and `layerType`, and the read-only `styleLayers` and `styleSources` list the current style.
