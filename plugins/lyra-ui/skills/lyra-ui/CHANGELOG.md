# Changelog

## 30.0.0

### Major Changes

- 6e32333: Use the JavaScript regex engine by default for fine-grained highlighting. Import the explicit Oniguruma factory and pass it to setShikiCoreEngine in place of the oniguruma string preset when custom grammars require its behavior. Full automatic language highlighting retains its existing engine.
- d60e64e: Item-identity collections now ignore an assignment of the array they already hold. Assign a new array to update; mutating an array or one of its items and assigning the same array again no longer re-renders.

  This applies to `lr-activity-feed` `entries`, `lr-agent-trace`, `lr-span-waterfall` and `lr-trace-tree` `spans`, `lr-calendar` `events`, `lr-claim-evidence` `claims` and `citations`, `lr-command-palette` `commands`, `lr-date-picker` `presets`, `lr-eval-dataset` and `lr-eval-run` `examples`, `lr-grounding-summary` `citations`, `lr-ingestion-queue`, `lr-node-palette`, `lr-prompt-queue`, `lr-task-list`, `lr-virtual-list`, `lr-mention-popover` and `lr-swatch-picker` `items`, `lr-map` `markers` and `dataLayers`, `lr-memory-panel` `shortTerm` and `longTerm`, `lr-retrieval-results` `chunks`, `lr-test-results` `suites`, `lr-thread-list` `threads` (unchanged) and `lr-tool-timeline` `entries`. Write `el.items = [...el.items, item]` instead of `el.items.push(item); el.items = el.items`. Opaque provider sources (`lr-virtual-list` `source`, `treeSource`, `dataSource`) keep refreshing when the same object is assigned again or `requestUpdate()` is called.

  The protected static `immutableSourceCollectionProperties` on `LyraElement` is removed; the rule is the default for every identity collection. `lyra-ui-migrate --rule=immutable-collections` reports in-place array changes and same-array reassignments on these properties with the `IMMUTABLE_COLLECTION_REVIEW` code (reports only, acknowledged with `lyra-migrate-reviewed: IMMUTABLE_COLLECTION_REVIEW:<property>`). See `llms/shared/v29-to-v30-migration.md`.
- d60e64e: `lr-map` gains camera commands and compares `center` by value.

  - **Breaking:** assigning a new `center` array with the same coordinates is now a no-op instead of re-centring the map over the user's pan. Call `jumpTo()` to re-centre explicitly.
  - `flyTo()`, `easeTo()` and `jumpTo()` honor reduced motion, queue until the engine exists and write the resulting camera back to `center` and `zoom`.
  - `lr-map-view-change` reports programmatic moves with `source: 'command'` and the visible `bounds`.
  - `cameraPadding` applies persistent camera padding, also used when fitting.
  - `fitToData()` frames markers, data layers and the choropleth; `fitBounds()` and camera commands no longer get interrupted by a same-tick `center` or `zoom` update.
  - `project()`, `unproject()` and a frame-throttled `lr-map-move` event.
- 5b83018: Remove the 36 deprecated public names whose compatibility window has ended. Each has a replacement that already works in 29.x.

  - Event aliases (the canonical event already fired first; listen to it instead): `lr-agent-run` and `lr-subagent-panel` `lr-cancel` -> `lr-run-cancel`; `lr-agent-eval-dashboard` and `lr-rag-eval-dashboard` `lr-metric-change` -> `lr-metric-change-request`; `lr-background-runs` `lr-run-open` -> `lr-run-activate`; `lr-change-review` `lr-change-decision` -> `lr-change-decision-request`; `lr-community-card`, `lr-path-strip`, `lr-entity-dossier`, `lr-memory-panel` and `lr-provenance-panel` `lr-entity-activate` -> `lr-entity-select`; `lr-chunk-inspector` `lr-chunk-toggle`, `lr-memory-panel` `lr-memory-toggle`, `lr-source-card` `lr-expand`, `lr-retrieval-trace` `lr-stage-toggle`, `lr-navigation-menu` `lr-expanded-change`, `lr-dock-panel` and `lr-widget` `lr-collapse-change` -> `lr-toggle` (the disclosure events carry `expanded`; the collapse events carried the opposite `collapsed`); `lr-dock-panel` and `lr-widget` `lr-collapse-request` -> `lr-toggle-request`; `lr-rag-eval-dashboard` `lr-run-change` -> `lr-run-activate` and `lr-slice-change` -> `lr-slice-change-request`; `lr-retrieval-results` `lr-select` -> `lr-selection-change`; `lr-source-picker` `lr-sources-change` -> `lr-selection-change`.
  - `icon` slot aliases: `lr-app-rail-item`, `lr-flow-node` and `lr-widget` content moves from `slot="icon"` to `slot="start"`, and `lr-tool-call-chip` content to `slot="status-icon"`. Content left in `icon` is no longer projected.
  - Parts that Web Awesome itself deprecated: the `base` part of `lr-accordion-item` (use `::part(accordion-item)`), `lr-file-input` (`file-input`), `lr-qr-code` (`qr-code`), `lr-sparkline` (`sparkline`) and `lr-video-playlist` (`video-playlist`); the `label` part of `lr-file-input` and `lr-known-date` (`form-control-label`).
  - `lr-icon` `autoWidth` / `auto-width`: use `canvas="auto"`.

  Migration: `npx lyra-ui-migrate --origin=lyra-v25` applies safe event renames and reports slot content, changed event details, and listeners whose reach would widen; the `wa-*`/`sl-*` migration maps the removed part names and `auto-width`. `wa-file-input` remains warning-required; apply its part replacements after reviewing the reported component differences. See the v29 to v30 upgrade guide.

### Minor Changes

- 955817c: Add `<lr-chart-3d>`, a bounded three-dimensional scatter, bubble and line chart over immutable typed columns of up to one million rows. It always renders an accessible, paginated data table with a keyboard cursor, and loads the optional `@aceshooting/lyra-3d` points renderer only for an explicit `engine="webgl"`, falling back to the table with a localized notice and `lr-engine-fallback`.
- 3c2bace: Add opt-in WebGL rendering to graph and embedding views and equirectangular panorama rendering to image and video views. Preserve built-in defaults and accessible alternatives, and expose typed-column inputs and localized panorama controls.
- 9c55bdd: `lr-map` covers more of what map applications build by hand:

  - `initialization="interaction"` builds the map on the first press, touch, wheel or key on the element, behind a localized `initialization-activate` button; `initializationDelay` also builds it after a delay.
  - Overlay layer paint and `styleOverrides` accept theme tokens, `currentColor` and CSS color functions, converted to sRGB and re-resolved when the theme changes. Overlay layers may target a source of the basemap style.
  - `lr-map-geolocate` reports `{ lngLat, accuracy }` after the user-activated geolocate control locates the user.
  - Drawing closes a polygon from a press on its first vertex, shows a rubber band to the pointer, offers localized on-map measurements (`drawingMeasurements`), completes on Enter and undoes on Backspace while the map has focus, survives a `mapStyle` swap, reports `lr-map-draw-vertex-end` when a vertex drag ends, and takes its color from `--lr-map-drawing-color`. A vertex drag now follows every pointer move instead of stopping after the first.
  - `lr-map-pointer-move` and `lr-map-pointer-leave` report the pointer position once per frame, and hover, context-menu and pick events carry the hit as a frozen GeoJSON `feature` with geometry.
  - `interactiveBasemapLayers` and `styleOverrides` select basemap layers by `source`, `sourceLayer` and `layerType`, and the read-only `styleLayers` and `styleSources` list the current style.
- afc026a: `lr-map` image capacity for sprite catalogs: `images` admits up to 1,024 entries within the unchanged pixel and byte budget, accepts `sdf: true` for signed-distance-field icons recolored by `icon-color`, and adds, replaces or removes images in place without removing and re-adding the layers that use them. The new `imageProvider` supplies missing images on demand through the engine's missing-image hook, sharing the same budget and re-adding them after a style swap.
- afc026a: `lr-map` renders large styled GeoJSON through `overlays`: a `geojson` source's `Feature` or `FeatureCollection` `data` object is kept by identity, outside the overlay value budget, so data of any size keeps native paint and layout expressions, filters, `minzoom`/`maxzoom`, symbol layers, `before` ordering, interaction and feature state across `mapStyle` swaps. A new data object updates the native source in place with `setData`, and `updateSourceData()` accepts overlay GeoJSON source IDs. Hits now skip a layer outside its zoom range at the fractional camera zoom, hidden, or with every opacity known to be `0`, so a hidden tier never shadows a visible one.
- 2e3e192: `lr-map` loads drawing, image export, URL hash ownership, owned resources, images, style overrides, anchors, controls and feature state on demand, cutting its initial download by about a quarter. Calls made while a feature loads return `false`; await `whenIdle()` and call again.
- 5c4824f: `lr-map` overlays and data.

  - `anchor` slot positioned at `anchorLngLat`: follows the camera, flips and shifts to stay inside the map, hidden while the point is off screen.
  - `choropleth.noData` (`color`, `strokeColor`, `label`): features without a numeric value paint with it, and a click on one reports `noData: true` in the `lr-map-click` detail.
  - `choroplethLegend` derives the legend from the choropleth (step bands, or a gradient bar with ticks, plus a no-data swatch); `legendGradientTicks` adds labelled marks to the gradient bar.
  - `cluster.zoomOnClick` eases into a clicked cluster.
  - Declarative `controls` (`navigation`, `scale` with a corner and a scale `unit`); button names follow `lang` changes live.
  - `LYRA_MAP_EMPTY_STYLE`, a frozen basemap-free style.
  - `maxBounds` now applies at a fractional zoom below 1 instead of being dropped.
  - The `immutable-collections` migration rule reports `lr-map` `center` assignments for review (`MAP_CENTER_REVIEW`), and the v29 → v30 guide has a Map section.
- afc026a: `lr-map` gains `hashFormat` (attribute `hash-format`). `'unnamed'` makes `hash = true` read and write the raw engine's unnamed `#zoom/lat/lng[/bearing[/pitch]]` fragment, so existing deep links keep working, while preserving named fields after it. Only a valid camera in the owned field or token suppresses the initial fit; an unrelated or malformed fragment leaves the fit to run and is not overwritten.
- afc026a: `lr-map` gains `minZoom` and `maxZoom` (attributes `min-zoom`, `max-zoom`): camera zoom limits forwarded to the engine at construction and live, clamping gestures, `zoom`, the URL `hash`, the camera commands and the `maxZoom` of `fitBounds()`/`fitToData()`.
- 38a734c: Add `<lr-model-viewer>`, a bounded static preview for glTF, GLB, STL, OBJ, PLY, XYZ and PCD files that renders with the optional `@aceshooting/lyra-3d/model` engine.

  - The companion loads lazily and only for a nonempty, supported source. A persistent text alternative and a guarded download link stay visible when the source, the companion or WebGL is unavailable.
  - Sources pass the shared URL policy and are read through a bounded reader with a fixed 64 MiB ceiling; model files cannot load external resources or run code.
  - The camera surface has keyboard orbit, zoom and fit (mirrored under RTL) and native toolbar buttons. `camera` is a copied, finite-checked property; user movement emits `lr-camera-change`.
  - `<lr-document-viewer>` opens model attachments in place through the new `kind: 'model'` payload and `model-viewer-register.js`. The registry also accepts lazy payload adapters (`rendererKind: 'adapted'`).

  The viewers-family gzip budget includes the new component with the reviewed 2% allowance. Package ceilings follow the measured model-viewer code, editor metadata and 13 translated controls, rounded to 64-byte boundaries; the UI archive retains its existing companion-pack allowance. The packed core registration graph retains 60 bytes of regression headroom above its measured non-asset size, with the required binary measured separately. The look-composition documentation route ceiling follows its measured UTF-8 size.
- 166f12c: Introduce `@aceshooting/lyra-3d`, the optional companion that will hold the WebGL engines behind Lyra UI's 3D views, with `three` as a regular dependency.

  - `@aceshooting/lyra-3d/core` exports the engine contract (`contract: 1`, `Lyra3dHost`, `Lyra3dEngine`, `Lyra3dStyle`) and the shared engine core: a WebGL2 viewport with software-rendering detection, an orbit camera that uses Lyra UI's camera values with fit and focus, GPU id picking, style validation, resizing, context-loss recovery that re-applies renderer state, reduced-motion camera transitions, disposal that releases the WebGL context, and module-worker tasks with a main-thread fallback.
  - Lyra UI lists `@aceshooting/lyra-3d` as an optional peer dependency. Graph, embedding, chart, model and panorama views load the corresponding companion engines lazily when their WebGL rendering is opted into; built-in defaults and accessible alternatives remain available.
- ff668f9: Extend declarative map composition and data-layer styling.

  - Document owner-scoped overlay composition, preserve control order within each corner, and support guarded links in custom attribution.
  - Add `before`, `minZoom` and `maxZoom` to GeoJSON data-layer rows, preserving generated-layer group order and applying visibility ranges to labels too.
  - Add physical label anchors and bounded text-size-relative offsets for point and line labels.
  - Add validated vector-layer paint, layout and filter options with a supported expression subset, theme-token colors and atomic admission before native updates.

  Existing map camera and immutable-collection changes already require the next major release; these additions introduce no further breaking change.

  The deferred map additions increase direct bundles that inline every reachable feature: both autoloaders, the viewers family through GeoJSON viewer, and SSR/all. Their measured gzip sizes are 1,651,344, 1,651,180, 419,654 and 1,661,479 bytes; only these four exceeded ceilings are refreshed with 2% headroom rounded up to a whole byte. Initial-load, CSS, component aggregate and other direct-entry ceilings stay unchanged.
- 6e32333: Add an explicit redraw revision for retained map canvases and bounded local image URLs for image data layers. Paint-only changes repaint idle maps, while mutable owned-layer updates preserve native source, layer and feature-state identity with guarded rollback.

  Keep native source options separate from immutable admitted snapshots so image URL updates can succeed without mutating caller data.
- f5b4bde: Add owned map resources and readiness, external data layers and labels, controls and feature interactions, drawing and vertex editing, anchored content options, image export, and lazy construction.
- aae417a: Declare `lr-menubar` and `lr-menubar-item` in `HTMLElementTagNameMap`, as every other component does, so `document.createElement()`, `querySelector()` and `closest()` return the typed classes.

### Patch Changes

- bdc75cc: Fix three rendering and accessibility defects.

  - `lr-terminal` and `lr-notebook-viewer`: an unterminated escape string (OSC, DCS, APC, PM or SOS) no longer swallows the rest of the output. A string now ends at BEL, CAN, SUB or the next ESC, and `ESC \` still terminates it.
  - `lr-color-picker`: `hsl()` and `hsla()` values resolve to the same 8-bit channels the browser computes, so `hsl(0, 100%, 95%)` formats as `#ffe6e6` (it was `#ffe5e5`). Hex, `rgb()` and `hsv()` input are unchanged.
  - `lr-eval-run`: the live region now announces examples that become `queued`, `collecting` or take an application-defined status ("{label}: {status}"); they were silent before.
- 52792ec: Use patched Zod 4 for Codecov build tooling, removing its remaining Zod 3 dependency. Preserve configuration validation, build-stopping errors, and normalized option types through a scoped compatibility patch. Verify both module formats and the GitHub job metadata/upload flow without contacting external services.
- 7fa4f02: Fit the embedding explorer's WebGL camera after measuring its viewport so initial point clouds fill the available space instead of appearing as a small central cluster.
- 30ca106: Preserve geolocation and attribution control constructors when loading the full MapLibre engine, so requested controls mount alongside navigation and scale controls.
- daaf791: Allocate a fresh native source identity when a map data layer changes its clustering configuration or rendering shape. Reserve the replacement before validating layer order, preserve existing resources when a proposal is rejected, and retain source identity for compatible data and paint updates.
- daaf791: Refresh the package size ceilings for map composition, lazy feature boundaries and source replacement. The UI archive measures 21,799,151 unpacked bytes (21,799,763 estimated bytes including the existing manifest allowance); translations measure 6,187,763 unpacked bytes, and editor metadata measures 1,700,103 packed and 10,535,164 unpacked bytes. Only the four exceeded ceilings advance to their next 64-byte boundaries. Download, file-count and other companion limits remain unchanged.
- 631a5d5: Wait for requested native map controls to finish loading and installing before resolving `whenIdle()`.
- 7fa4f02: Keep image catalog updates and lazy image-provider changes in the same map resource transaction. Updating both after initialization, or replacing a provider while images are preparing, now preserves the live map and waits for the current resources.
- daaf791: Keep map layer ordering and style overrides behind their existing lazy feature loader. GeoJSON placement waits for the ordering helper before changing native resources; bounded style-value validation is shared without importing override handling eagerly.
- ba97350: Allow bundlers to remove unused map feature loaders from an unused manual autoloader import while preserving lazy loading, shared caching, and retries for requested map features.
- 7fa4f02: Preserve ordinary font-family records when snapshotting map styles so the full MapLibre engine accepts native font declarations on initial load and style replacement. Font descriptors remain detached and immutable, including family names that match inherited object properties.
- c9a3891: Record the measured delivery cost of map resource and control-readiness handling, constrained popup placement, and cancellable autofocus-safe popover reveals. The direct media, overlays and popover bundles measure 343,322, 152,436 and 60,237 gzip bytes; popover's initial marginal payload measures 18,090 bytes. Advance only these breached ceilings to the next 64-byte boundaries: 343,360, 152,448, 60,288 and 18,112 bytes.

  The UI package's estimated unpacked payload measures 21,799,880 bytes; its ceiling advances to 21,799,936 bytes. Preserve all passing limits, the compressed-download ceiling, historical unpacked reduction target, file-count allowance, companion limits, shared-shell imports, optional-peer exclusions and measurement settings.
- 5c66e18: Record the observed limits of the release's runtime benchmarks. A matched quick Chromium
  comparison against 29.2.2 passed all 15 semantic workloads with unchanged workload counts, but
  12 of 150 timing metrics exceeded both the 15% and 1 ms material-regression thresholds. These
  include document filtering paint, table assignment and sorting paint/no-op phases, chart
  assignment, select metadata paint, and combobox metadata updates. For 1,000-record chart
  assignment, observed p95 rose from 112.7 to 148.3 ms while the median remained 77.7 versus
  77.5 ms; update and settlement tails increased in the same sample. Each run contained seven
  samples, so its reported p95 is the largest observation.

  One matched diagnostic trace pair recorded frame waiting in the scheduling control and real
  layout and garbage-collection work in both chart implementations. The largest chart tail did
  not recur in that pair, and its cause remains unestablished. The original comparison remains
  a documented performance limitation. The traced workloads and unchanged counts do not establish
  equivalent performance for every workload or device.
- 3cc71c2: Keep mention caret measurements explicitly text-only, avoid excessive backtracking when parsing malformed 3D color values, and escape embedded values when generating map modules.
- 631a5d5: Measure CSS-constrained popup dimensions before reporting their initial position, keeping large select menus and other overlays inside the available space.
- 7fa4f02: Simplify overlay activation when an open tooltip changes its interactive content, removing an unreachable closed-tooltip branch while preserving focus management.
- 1c49a93: Preserve focus when hover and focus triggers reveal popover content with autofocus. Keep pending popups inert and cancel their pending reveal when closing or disconnecting.
- d84c719: Validate constrained message, notebook, form, calendar, formatter and provider inputs before rendering or emitting state. Preserve documented fallbacks for unknown lookup keys and reject forged restored files. Bound signature restoration by inspected input positions.

  Validate map resource metadata before rendering, keep explicit source and protocol registration authoritative, and preserve arbitrary valid sprite identifiers across worker transport. Unknown flag codes now consistently resolve to undefined across package entry points.
- 04a9d6f: Prevent native video playback updates from causing unintended seeks, while preserving explicit playback-position changes.
- Updated dependencies [e2701e9]
- Updated dependencies [6da5b00]
- Updated dependencies [5e6b131]
- Updated dependencies [1c49a93]
- Updated dependencies [166f12c]
- Updated dependencies [8087f55]
- Updated dependencies [27d9e64]
- Updated dependencies [ffb5c06]
- Updated dependencies [3cc71c2]
- Updated dependencies [96ac5e7]
- Updated dependencies [d84c719]
  - @aceshooting/lyra-3d@1.0.0
  - @aceshooting/lyra-map@1.3.0
  - @aceshooting/lyra-flags@2.3.1
  - @aceshooting/lyra-translations@30.0.0

Older major versions: [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
