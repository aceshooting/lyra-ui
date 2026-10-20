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

## Raw-engine applications

Some applications build their map directly on the `@aceshooting/lyra-map` engine (about ten overlay
layers, vector tiles, sprites, feature state, drawing) because `lr-map` lacks what they need. These
items let them move to `lr-map`, or at least drop their workarounds on the engine:

- [ ] Overlays survive a `mapStyle` swap (basemap or theme change): data layers, markers, custom
  sources and images are re-applied automatically, instead of every layer re-adding itself on style
  load.
- [ ] A readiness primitive: `whenStyleReady()` / `whenIdle()` and matching `lr-map-style-load` and
  `lr-map-idle` events, instead of guarding `isStyleLoaded()` and racing style loads.
- [ ] Data-layer ordering: a band or `before` option on data layers instead of a hand-maintained
  z-order table re-applied after each style swap.
- [ ] `styleOverrides`: paint and layout overrides for basemap style layers, re-applied after style
  loads.
- [ ] `images` property accepting SVG markup or URLs, rasterized portably (engines cannot decode SVG
  blobs everywhere), for symbol layers.
- [ ] Modular engine: load the feature modules implied by `addLayer`/`addSource` automatically, or a
  documented shorthand, instead of preparing dummy sources and layers.
- [ ] Controls: geolocate (with localized error and out-of-bounds events), attribution options, a
  scale `unit`, and control text that follows `lang` changes live.
- [ ] `hash` and `maxBounds` properties, with initial fitting that yields to a URL hash.
- [ ] Pointer workflows: `lr-map-contextmenu` event, a pick mode (crosshair cursor emitting
  `lr-map-pick`), and a polygon/line draw mode with `lr-map-draw-*` events (area, length, centroid).
- [ ] Anchored content clamps under fixed application chrome (boundary and safe-area insets),
  stacks above other popups, and has a localized close label.
- [ ] `exportImage({ type, attribution })` returning a `Blob` of the current view.
- [ ] Document that the modular engine shapes right-to-left text without a plugin, so applications
  drop runtime plugin fetches from third-party CDNs.
- [ ] Data layers backed by vector tile sources (tiles URL with per-source-layer paint) and by image
  or raster sources (canvas or data URL on corner coordinates, updated in place), surviving style
  swaps.
- [ ] Interactive data layers: hit priority across overlays (topmost wins; background click only
  when nothing is hit), a hover cursor that yields to pick mode, a feature-state API, and opt-in of
  basemap style layers (for example building footprints) into `lr-map-click`.
- [ ] Per-data-layer `minZoom`/`maxZoom` and symbol text labels (line-placed labels, point names,
  halo, colors from theme tokens).
- [ ] Repaint after paint changes applied through data layers on every engine (WebKit otherwise
  skips a frame).
- [ ] First-class lazy construction (build on visibility or idle with a built-in control
  placeholder), so applications stop deferring the map behind timers.
- [ ] Worker plugin defaults for chunk naming, and documentation of the single-instance requirement
  when a workspace re-exports the plugin.

## Documentation

- [ ] Migration guide from the raw engine to `lr-map`, and the supported overlay-persistence pattern.

- [ ] State that `lyraMapWorkerPlugin()` needs no pre-import or readiness gate, and that `LyraMap.preload()`
  is the supported warm-up.
- [ ] Migration notes for the full-`maplibre-gl` engine to the modular engine, including the worker
  setup the full engine still needs.

## Application migration (after the 30.0.0 release)

Maintained applications that build on the raw engine move to `lr-map` once the items above ship,
deleting their engine workarounds (style-reload re-adding, z-order tables, dummy feature
preparation, hand-clamped popups, selector-based control relabelling, SVG rasterization, startup
timers and engine CSS overrides):

- [ ] Main site application and its shared map package.
- [ ] World site application.
- [ ] Regional site application (same map package as the main site).
- [ ] Applications already on `lr-map` drop the workarounds listed in the sections above.

## Exit

Every item has JSDoc, three-engine tests, a story and `llms/media.md` coverage; maintained
applications drop the corresponding workarounds in the consumer rollout after the release.
