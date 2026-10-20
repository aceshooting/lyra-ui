# Map adoption (`lr-map`, `@aceshooting/lyra-map` 1.3.0)

Status: planned for lyra-ui 30.0.0 with lyra-map 1.3.0. Applications using `lr-map` still reach into
the engine through the `map` getter, or keep workaround code, for camera moves, padding, popups,
fitting and missing data. This plan closes those gaps so map screens share one accessible, themed
component and applications delete their workarounds.

## Breaking change

- [ ] **`center` compares by value.** Assigning a new but equal `[lng, lat]` array is a no-op instead
  of re-centring the map over the user's pan; `jumpTo()` is the explicit way to re-centre. Migration
  note and a `lyra-ui-migrate` review entry.

## Camera

- [ ] `flyTo(options)`, `easeTo(options)`, `jumpTo(options)` methods that honor reduced motion, queue
  before the engine exists and write the result back to `center` and `zoom`.
- [ ] `lr-map-view-change` reports programmatic moves (`source: 'command'`) and the visible `bounds`.
- [ ] `cameraPadding` property applied persistently and used by fitting and view-change reports.
- [ ] `fitToData(options?)` frames markers, data layers and the choropleth from already-projected
  geometry; `fitBounds()` waits for a pending property update instead of being interrupted by it.
- [ ] `project(lngLat)` / `unproject(point)` and a frame-throttled `lr-map-move` event.

## Overlays and data

- [ ] Anchored content for a clicked feature (an `anchor` slot positioned at `anchorLngLat`, hidden
  when off-screen), replacing hand-positioned popups.
- [ ] `choropleth.noData` (color, stroke, label): features without a value paint and click with
  `noData: true`, instead of applications splitting their data into a second layer.
- [ ] Choropleth-derived legend for step ramps and `legendGradientTicks`.
- [ ] `cluster.zoomOnClick`.
- [ ] Declarative `controls` (navigation and scale, with position).
- [ ] Exported empty basemap style constant.
- [ ] `bounds` limits that tolerate fractional zoom below 1.

## Documentation

- [ ] State that `lyraMapWorkerPlugin()` needs no pre-import or readiness gate, and that `LyraMap.preload()`
  is the supported warm-up.
- [ ] Migration notes for the full-`maplibre-gl` engine to the modular engine, including the worker
  setup the full engine still needs.

## Exit

Every item has JSDoc, three-engine tests, a story and `llms/media.md` coverage; maintained
applications drop the corresponding workarounds in the consumer rollout after the release.
