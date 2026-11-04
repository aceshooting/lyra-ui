---
'@aceshooting/lyra-map': minor
---

Update the renderer engine to MapLibre GL JS 6.16.0, rebuilt from the reviewed 6.16.0 source with the same asynchronous feature preparation and shared module worker.

- The `transformStyle` map option applies a style transformation from construction on, and later `setStyle()` calls reuse it unless they pass their own.
- `setMaxBounds()` can constrain one axis only: use `-Infinity` and `Infinity` for an unconstrained longitude range with finite latitude limits.
- Maps keep loading after a mobile browser shuts down their background workers. On return to the foreground the workers are pinged and, if they do not answer, restarted. Each map then rebuilds its style and fires `webglcontextlost` and `webglcontextrestored`, as after a WebGL context loss. The rebuilt style exists when `webglcontextrestored` fires and keeps images added with `addImage()`. Liveness checks are answered without waiting for pending feature preparation.
- `importScriptInWorkers()` loads each URL once and loads it again into replacement workers. The `GlobalDispatcher`, `GlobalDispatcherEventType`, `CustomMessageHandler` and `MessageHandler` types are exported.
- Fixes: a resize between WebGL context loss and its event no longer shrinks the map to one pixel; expired vector tiles reloaded with an unchanged ETag no longer fail; `font-faces` characters keep their glyphs after a glyph range downloads; a constant `line-dasharray` without dash positions no longer throws; `GeoJSONSource.getBounds()` accepts `null` geometries and `updateData()` no longer applies a queued update to a feature that a later call adds again; images added with `addImage()` appear in tiles reloaded across 180°; vector tiles past the source maxzoom load when slicing leaves a one-point line; terrain no longer draws flat at the DEM source's minzoom; `queryRenderedFeatures()` finds all of a GeoJSON polygon whose ring is not closed.
- The vector tile encoder is updated to 4.3.3.
