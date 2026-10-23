# Map adoption (`lr-map`, `@aceshooting/lyra-map` 1.3.0)

Status (2026-10-23): the camera, overlays, composition, ordering, controls, labels and lazy
construction APIs and their migration documentation are implemented on main for lyra-ui 30.0.0
with lyra-map 1.3.0. Implementation checkboxes below record that source and documentation work;
they do not establish release qualification. Installed-package font and label rendering,
application prototypes, visual acceptance and request acceptance remain open in the
application-coverage gate. Current map fixes are still undergoing qualification.

Applications can replace camera, padding, popup, fitting and missing-data workarounds with the
supported component API. Application migration follows the release.

## Breaking change

- [x] **`center` compares by value.** Assigning a new but equal `[lng, lat]` array is a no-op instead
  of re-centring the map over the user's pan; `jumpTo()` is the explicit way to re-centre.
- [x] Migration note for the value-compared `center` in the v29 → v30 guide and a
  `lyra-ui-migrate` review entry.

## Camera

- [x] `flyTo(options)`, `easeTo(options)`, `jumpTo(options)` methods that honor reduced motion, queue
  before the engine exists and write the result back to `center` and `zoom`.
- [x] `lr-map-view-change` reports programmatic moves (`source: 'command'`) and the visible `bounds`.
- [x] `cameraPadding` property applied persistently and used by fitting and view-change reports.
- [x] `fitToData(options?)` frames markers, data layers and the choropleth from already-projected
  geometry; `fitBounds()` waits for a pending property update instead of being interrupted by it.
- [x] `project(lngLat)` / `unproject(point)` and a frame-throttled `lr-map-move` event.

## Overlays and data

Status (2026-10-20): the items below are on main. The anchored content uses the deferred positioner.

- [x] Anchored content for a clicked feature (an `anchor` slot positioned at `anchorLngLat`, hidden
  when off-screen), replacing hand-positioned popups.
- [x] `choropleth.noData` (color, stroke, label): features without a value paint and click with
  `noData: true`, instead of applications splitting their data into a second layer.
- [x] Choropleth-derived legend for step ramps and `legendGradientTicks`.
- [x] `cluster.zoomOnClick`.
- [x] Declarative `controls` (navigation and scale, with position).
- [x] Exported empty basemap style constant.
- [x] `bounds` limits that tolerate fractional zoom below 1.

## Raw-engine applications

Some applications build their map directly on the `@aceshooting/lyra-map` engine (about ten overlay
layers, vector tiles, sprites, feature state, drawing) because `lr-map` lacks what they need. These
items let them move to `lr-map`, or at least drop their workarounds on the engine:

- [x] Overlays survive a `mapStyle` swap (basemap or theme change): data layers, markers, custom
  sources and images are re-applied automatically, instead of every layer re-adding itself on style
  load.
- [x] A readiness primitive: `whenStyleReady()` / `whenIdle()` and matching `lr-map-style-load` and
  `lr-map-idle` events, instead of guarding `isStyleLoaded()` and racing style loads.
- [x] Data-layer ordering through `before` on GeoJSON and external data layers and owned overlays,
  with logical group ordering restored after style swaps. Unanchored groups retain their input
  order; invalid ordering is rejected before native changes.
- [x] `styleOverrides`: paint and layout overrides for basemap style layers, re-applied after style
  loads.
- [x] `images` property accepting SVG markup or URLs, rasterized portably (engines cannot decode SVG
  blobs everywhere), for symbol layers.
- [x] Modular engine: load the feature modules implied by `addLayer`/`addSource` automatically, or a
  documented shorthand, instead of preparing dummy sources and layers.
- [x] Controls: geolocate (with localized error and out-of-bounds events), attribution options, a
  scale `unit`, and control text that follows `lang` changes live.
- [x] `hash` and `maxBounds` properties, with initial fitting that yields to a URL hash.
- [x] Pointer workflows: `lr-map-contextmenu` event, a pick mode (crosshair cursor emitting
  `lr-map-pick`), and a polygon/line draw mode with `lr-map-draw-*` events (area, length, centroid).
- [x] Anchored content clamps under fixed application chrome (boundary and safe-area insets),
  stacks above other popups, and has a localized close label.
- [x] `exportImage({ type, attribution })` returning a `Blob` of the current view.
- [x] Document that the modular engine shapes right-to-left text without a plugin, so applications
  drop runtime plugin fetches from third-party CDNs.
- [x] Data layers backed by vector tile sources (tiles URL with per-source-layer paint) and by image
  or raster sources (canvas or data URL on corner coordinates, updated in place), surviving style
  swaps.
- [x] Interactive data layers: hit priority across overlays (topmost wins; background click only
  when nothing is hit), a hover cursor that yields to pick mode, a feature-state API, and opt-in of
  basemap style layers (for example building footprints) into `lr-map-click`.
- [x] Per-data-layer `minZoom`/`maxZoom` on GeoJSON and external data layers, and symbol text
  labels (line placement, point names, halo and colors from theme tokens). Native installed-font
  rendering and visual acceptance remain part of release qualification below.
- [x] Repaint after paint changes applied through data layers on every engine (WebKit otherwise
  skips a frame).
- [x] First-class lazy construction (build on visibility or idle with a built-in control
  placeholder), so applications stop deferring the map behind timers.
- [x] Worker plugin defaults for chunk naming, and documentation of the single-instance requirement
  when a workspace re-exports the plugin.

## Documentation

- [x] Migration guide from the raw engine to `lr-map`, and the supported overlay-persistence pattern
  ([authored guide](../../packages/lyra-ui/llms/media.md#migrating-a-raw-engine-map-to-lr-map)).

- [x] State that `lyraMapWorkerPlugin()` needs no pre-import or readiness gate, and that `LyraMap.preload()`
  is the supported warm-up.
- [x] Migration notes for the full-`maplibre-gl` engine to the modular engine, including the worker
  setup the full engine still needs.

## Release gate: application coverage

30.0.0 is not released until `lr-map` covers every map need of the maintained applications that
use it or the raw engine (the timeline application, the main site, the world site, and the
regional site, whose map package is a separate fork of the main site's):

- [x] Re-audit each application's map code against the final `lr-map` API and record, per need,
  the `lr-map` feature that covers it (with evidence: a test, story or prototype), or why it stays
  application-specific. The 2026-10-22 audit recorded 122 needs; the open ones follow.
- [x] Large styled GeoJSON overlays: native paint expressions, zoom ranges, `before` ordering and
  symbol layers on data beyond the current `overlays` admission limits.
- [x] `minZoom`/`maxZoom` camera limits.
- [x] `hash` compatibility with the engine's unnamed `#zoom/lat/lng` fragment, and a documented
  rule for whether any fragment suppresses the initial fit.
- [x] Image capacity for sprite catalogs (more than 64 images, `sdf`, a missing-image provider)
  without re-adding every owned layer on an image change.
- [x] Lazy construction on first interaction or after a delay, with an interactive placeholder.
- [x] Theme tokens in `overlays` paint.
- [x] A geolocation success event carrying the position.
- [x] Drawing parity: closing snap, rubber band, measurement labels, map-level Backspace/Enter,
  surviving a style swap, a drag-end signal and a color option.
- [x] Pointer events with `{ lngLat, point }` and feature geometry on hover events.
- [x] Basemap layer selectors and a read-only style-layer list.
- [x] Canvas redraw signal and bounded `data:`/`blob:` image URLs for image layers, with retained
  source identity and replay after style changes.
- [x] In-place updates of owned layers, preserving feature state and rolling back failed changes.
- [x] Independent modules compose through one owner that publishes their source and layer
  snapshots with globally unique IDs. Native controls have stable order within a corner and
  support linked custom attribution.
- [ ] Prototype each raw-engine application on `lr-map` against the release candidate build and
  confirm the same behavior (basemap and theme switching, overlays, popups, drawing, geolocation,
  URL hash, right-to-left, translations, mobile layout).
- [ ] No open `component:lr-map` request in Lyra Admin.

The prototype gate includes installed-package native font and label rendering, representative
right-to-left text and locale/mobile configurations, and review of the retained visual captures.
Existing component and native-engine tests can supply matching behavioral evidence; selected
controller prototypes and synthetic fixtures establish only the behavior they actually exercise.
Keep application-owned behavior and accepted residual scope explicit when reconciling the needs.
Neither implementation completion nor an automated prototype pass closes visual or request acceptance.

## Application migration (after the 30.0.0 release)

Maintained applications that build on the raw engine move to `lr-map` once the items above ship,
deleting their engine workarounds (style-reload re-adding, z-order tables, dummy feature
preparation, hand-clamped popups, selector-based control relabelling, SVG rasterization, startup
timers and engine CSS overrides):

- [ ] Main site application and its shared map package.
- [ ] World site application.
- [ ] Regional site application (a separate fork of the main site's map package; re-sync first).
- [ ] Applications already on `lr-map` drop the workarounds listed in the sections above.

## Exit

Every item has JSDoc, three-engine tests, a story and `llms/media.md` coverage; maintained
applications drop the corresponding workarounds in the consumer rollout after the release.
