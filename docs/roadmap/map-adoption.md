# Map adoption (`lr-map`, `@aceshooting/lyra-map` 1.3.1)

Status (2026-10-25): the camera, overlays, composition, ordering, controls, labels and lazy
construction APIs and their migration documentation shipped in
[lyra-ui 30.0.0](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-ui%4030.0.0) with
lyra-map 1.3.0. The published source is `578919f6a61a31612a0382c02cbae84202466837`.
Installed-package font and label rendering, selected application prototypes, visual review and
the release's request acceptance are complete within the scope recorded below. Versioned release
qualification and publication are complete; complete application migration remains separate.

A regression in 30.1.0 affects asynchronous modular object-style replacement: active
ordering overrides can reject readiness, and the public layer catalog can retain the previous
style. The correction now passes affected tests in Chromium, Firefox with WebGL, and WebKit;
it shipped in [lyra-ui 30.2.0](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-ui%4030.2.0). The [30.2 maintenance record](30.2-maintenance.md) records
exact-commit qualification and delivery.

Published 30.2 maintenance also replaces full feature-preflight snapshots with validated
requirement metadata, authors the preparation runtime as directly testable code, and retains
stable map-anchor placement sessions during camera movement. Full companion coverage records
100% lines and statements; parity, provenance and packed three-engine checks pass for the exercised
candidate. Production preflight and anchor measurements retain their individual fixture and source
scope; native ingestion remains separate from preflight. Exact-commit release qualification,
including mutation testing, is complete. [lyra-map 1.3.1](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-map%401.3.1) and [lyra-ui 30.2.0](https://github.com/aceshooting/lyra-ui/releases/tag/lyra-ui%4030.2.0)
were published on 2026-10-25. See the [maintenance status table](30.2-maintenance.md#implementation-status).

Applications can replace camera, padding, popup, fitting and missing-data workarounds with the
supported component API. Published 30.1.0 corrections cover URL-style readiness, anchor visibility
and live direction changes, boundary containment, and public geolocation-group and
attribution-content styling parts. The release adds experimental independently owned
`lr-map-anchor` panels and `styleOverrides.before` for ordering existing basemap layers relative
to native layers or public overlay groups, without copying their sources or geometry. The
integrated map and SSR suite passed 1,940 cases in each of Chromium, Firefox with WebGL, and WebKit;
the final release also passed [exact-commit qualification](test-health.md#current-3010-qualification).
Those completed checks do not resolve the later object-style replacement regression above.

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
- [x] Existing-basemap ordering shipped in 30.1.0:
  `styleOverrides.before` targets a native layer or public overlay group; `null` places the matched
  layers above all others. Omitting it releases ordering ownership and restores the prior relative
  position. Selector matches keep their relative order, and managed layers retain their own
  ordering APIs. The asynchronous object-style replacement follow-up shipped in 30.2.0 as recorded above.
- [x] Defer overrides for absent basemap subjects without failing readiness, then retry when a
  matching layer exists. Observed absence discards obsolete restoration ownership; invalid or
  conflicting resources still fail. This correction shipped in 30.1.0; the later replacement
  regression was corrected in 30.2.0 as recorded above.
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
- [x] Several independently owned anchored panels shipped in 30.1.0: experimental
  `lr-map-anchor` children rendered through the `anchors` slot, each opened, moved and closed by its
  own owner. Content stays caller-owned light DOM; safe areas and boundaries are per anchor or
  inherited from the map; overlapping panels paint and take Escape by focus and recency; focus
  returns when a focused anchor hides, closes or is removed.
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

The 30.0.0 release gate required coverage of the recorded map needs of maintained applications that
use `lr-map` or the raw engine (the timeline application, the main site, the world site, and the
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
- [x] Qualify selected controller prototypes for each raw-engine application against installed
  candidate packages, combining the exercised behavior with matching native/component tests
  (basemap and theme switching, overlays, popups, drawing, geolocation, URL hash, right-to-left,
  translations, mobile layout).
- [x] Close the release-blocking map requests recorded for the 30.0.0 prototype gate. New requests
  after publication, including multiple independent anchors, remain open and are not covered by
  this historical acceptance.

The prototype gate includes installed-package native font and label rendering, representative
right-to-left text and locale/mobile configurations, and review of the retained visual captures.
Existing component and native-engine tests can supply matching behavioral evidence; selected
controller prototypes and synthetic fixtures establish only the behavior they actually exercise.
Keep application-owned behavior and accepted residual scope explicit when reconciling the needs.
Neither implementation completion nor an automated prototype pass closes visual or request acceptance.

Acceptance on 2026-10-24 combines 36 installed prototype configurations (development/production,
Chromium/Firefox/WebKit, desktop/mobile RTL), six font/label configurations and matching native
and component tests. All retained prototype and label images were reviewed. Selected controllers
and fixtures exercise the documented needs; they do not constitute migration of complete applications.
Caller responsibilities remain explicit: direction-aware custom legend layout and, for direct
engine scene transactions, the documented bounded presentation repaint. These must be carried
into the later application migration. No library readiness contract was changed to obtain the
captures. Final versioned package qualification subsequently completed for the published 30.0.0
release; later fixes and application migrations require their own acceptance.

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
