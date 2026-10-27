# Changelog

## 30.5.0

### Minor Changes

- 13b4c5d: Add `controls.attribution.initialExpanded` to `lr-map`, an initial-only seed for the compact credits disclosure, and the non-cancelable `lr-map-attribution-toggle` event (`detail.expanded`), which reports later changes of the owned attribution control without firing on installation, seeding, replacement or reconnect. Requested control outlines now stay in place, decorative and non-interactive, after the map is constructed until those controls finish loading, and paint with the installed controls' glass or solid surface material.

  Add the opt-in `keyboardActivation` property (attribute `keyboard-activation`): while the map canvas has focus, an unmodified Enter or Space activates the interactive feature at the view centre through the click hit query and emits `lr-map-click` with `trigger: 'keyboard'`. Add `getVisibleBounds({ padded? })`, a synchronous read of the padded or full visible box that returns `null` before the engine exists.

  The attribution state tracking, pending control outlines, keyboard centre activation and visible-bounds reader add runtime code, and their guides and generated editor data increase archive sizes. Only the exceeded media and viewers bundle ceilings, the unpacked UI archive ceiling and the generated IDE archive ceilings advance to the next 64-byte boundary; passing limits and measurement inputs remain unchanged.

### Patch Changes

- @aceshooting/lyra-translations@30.5.0

## 30.4.0

### Minor Changes

- fea5203: Add the shared optional size ladder to copy buttons. Keep viewport modals above ancestor stacking contexts and preserve their visual order across reconnects. Avoid redundant layout measurements and stale navigation-menu resize callbacks, and correct tooltip, sizing, and theme-contrast documentation.

  Shared modal ordering and exit handling, allocation-preserving drawers, and copy-button sizing add runtime code; their required guides and generated editor data increase archive sizes. Only exceeded bundle and archive ceilings advance to the next 64-byte boundary after composition review; passing limits, measurement inputs and the UI download cap remain unchanged.

  Make panorama pause-ownership qualification handle native callback delivery before the queued pause event, with deterministic coverage of both event orders.

  Two compatible seven-sample Chromium quick comparisons against 30.3.0, run in opposite orders, retained 21 and 12 timing threshold exceedances. The second pair measured 10,000-row assignment median total time at 27.2 to 40.0 ms and chart-assignment p95 at 110.5 to 178.5 ms. All semantic checks and recorded work counts matched. Causes remain unresolved; neither pair is a performance pass. These advisory findings remain separate from passing preliminary hosted A/B qualification.

### Patch Changes

- @aceshooting/lyra-translations@30.4.0

## 30.3.0

### Minor Changes

- 0d840bd: Add explicit widget registry and binding-state passthrough to message parts, preserve widget
  identity during sibling text updates, and load non-text part renderers on demand. Correct the
  structural A2UI-like helper's binding-state result and extend AG-UI reasoning/activity/custom
  mapping with host-controlled custom-event destinations.

  Add an opt-in official MCP Apps host transport with negotiated capabilities, bounded requests,
  resource policy, cancellation and teardown alongside the existing default bridge. Incremental
  text-delta accounting preserves untouched payload identities and handles UTF-8 surrogate joins
  without repeatedly scanning retained message data. Support and qualification boundaries are
  documented with the corresponding APIs.

  The seven-sample quick Chromium comparison with 30.2.0 recorded eight advisory timing regressions
  across table assignment, chart assignment and combobox metadata. Table update median increased
  from 5.9 to 7.4 ms, while total median decreased from 28.1 to 27.7 ms; total p95 increased from
  28.5 to 41.4 ms. The affected module closures and theme bytes are unchanged, and functional
  assertions and bounded-work counts pass. Phase redistribution and isolated slow samples contribute
  to these observations; their cause remains unresolved, so no runtime speedup is claimed.
- c3b40ec: Expose map control container, corner, native icon and attribution-link parts, geolocation state
  parts and expanded-attribution styling hooks. Add `--lr-map-scale-bar-display` to hide the scale
  ruler independently of its distance text. Control option objects now accept finite `order`
  values to keep visual and keyboard order aligned while retaining existing controls.
  Use theme-aware SVG control icons while preserving native compass rotation, and give attribution
  links a 24px minimum target size.

  Add `whenControlsReady()` for installed native controls and synchronized chrome, and expose
  initialization skeleton, label and control-corner parts so deferred maps can share control styling.
  Independent top and bottom rows and expanded-attribution container tokens support responsive layouts.

  The map layout/readiness helpers, icons and public references increase the media bundle to
  350,928 gzip bytes and the UI archive to 21,969,742 unpacked bytes. Advance only exceeded media,
  UI and editor byte ceilings to the next 64-byte boundary; retain all passing limits and file ceilings.

  The tiled map scale DOM ceiling increases from 15 to 17 for the two fixed control-row wrappers;
  all data-dependent scale ceilings remain unchanged. The tile test verifies both rows are reused
  across camera moves and overlay updates.

### Patch Changes

- 0d840bd: Preserve keyboard scroll intent through native smooth scrolling so Home, PageUp and upward arrow
  navigation can release chat following. Clear obsolete intent after settlement, cancellation,
  focus changes and explicit scroll commands, including virtual conversations. Prevented keys and
  editing controls retain their native behavior.
- 0d840bd: Keep file-input labels, selected files and feedback inside intrinsically sized grid rows. Definite-height drop targets allocate the remaining space to the picker after the rest of the field content.
- 0d840bd: Add measured Gen bundle and archive limits for parser, runtime, chat, generated views and chat
  composition. JavaScript permits 2% headroom, CSS 4%, and assets none; external optional peers
  remain listed separately. Archive increases use the next 64-byte boundary.

  Widgets, MCP Apps, chat scroll intent, public type exports, documentation and seven Gen messages
  across all 70 locale catalogs increase UI, editor and translation bytes. Raise only exceeded
  ceilings; retain passing limits, the download ceiling, historical reduction rule and file inventories.

  Navigation and server/client examples, catalog and adapter guides, CLI presets and the candidate
  adapter correction increase Gen to 140 public files. Set its archive byte ceilings to the next
  64-byte boundary. Interactive select validation adds 57 gzip bytes over its reviewed measurement; advance
  only its exceeded direct-entry ceiling to the next 64-byte boundary.

  Reviewed 2026-10-26: Gen measures 206,707 packed / 770,450 unpacked bytes across 140 files.
  Set its ceilings to 206,720 / 770,496 bytes. The latest growth is the SDK 7 integration guide
  and initial release notes; runtime entries, file count and other passing limits stay unchanged.
- 0d840bd: Include generated-view status and action messages in every conversation locale catalog, retain
  per-instance overrides, and update loaded MCP app locale and direction context without replacing
  its frame. Locale changes during official app initialization are retained until the app is ready.
- 3d5644c: Expose a required select's invalid state after native form submission or `reportValidity()`,
  including its accessible state and error styling. Silent validity checks keep pristine controls
  unchanged, and resetting the form restores that state.
- @aceshooting/lyra-translations@30.3.0

## 30.2.0

### Minor Changes

- 6c9751f: Wait for modular map style replacements to commit before restoring owned layers and basemap overrides. Block presentation-linked external media in PPTX slides and thumbnails while retaining embedded media. Deliver accessible-text notifications after the active render cycle so rail hover and keyboard focus do not trigger update warnings.

### Patch Changes

- d9fe8ee: Retain map-anchor placement subscriptions across camera movement, recover failed placement sessions, and avoid repeated overflow-admission scans. Consolidate hierarchy-source, prepared-chart, and default-label helpers while preserving cancellation, accessibility, and query bounds. Correct maturity metadata for published experimental components.

  Use cancellable asynchronous model preparation when the model companion supports it, retaining compatibility with older companion versions.

  Shared lifecycle helpers and regenerated component metadata increase several bundle and package measurements. Advance only exceeded byte ceilings to the next 64-byte boundary; retain the existing download, unpacked-reduction, artifact, and optional-peer policies.

  The current-harness Chromium quick comparison against published 30.1.0 retains all functional assertions and recorded operation counts, but reports material timing increases in dataset selection, table filtering and no-op painting, chart assignment, and select metadata painting. Chart-assignment total p95 rises from 94.0 to 147.4 ms while its median remains approximately 77 ms; table-filter no-op total median rises from 8.2 to 10.7 ms, and select metadata paint median from 11.7 to 15.0 ms. These seven-sample measurements do not isolate the cause, and no general timing improvement is claimed. Wall-clock results remain advisory; deterministic scale budgets and release A/B qualification remain required.
- Updated dependencies [074e36a]
- Updated dependencies [8b60e43]
  - @aceshooting/lyra-map@1.3.1
  - @aceshooting/lyra-3d@1.1.0
  - @aceshooting/lyra-translations@30.2.0

## 30.1.0

### Minor Changes

- Add `lr-show`, `lr-after-show`, `lr-hide` and `lr-after-hide` lifecycle events to `lr-locale-picker`. Ordinary opening and closing requests can be vetoed; forced closes and superseded transitions retain consistent settled state.
- Add `styleOverrides.before` to order existing basemap layers without copying their sources or geometry. Selectors retain stable relative order, placement coordinates with owned overlays, and removing the override restores its prior position among surviving unowned layers.

  The locale-picker lifecycle and basemap placement logic, declarations and generated references increase the locale-picker initial route, media family and package sizes. Only exceeded ceilings advance to the next 64-byte boundary; passing budgets, peer exclusions, lazy loading and measurement settings remain unchanged.

- 55ec21c: Add the experimental `<lr-map-anchor>` element for several independently owned panels on one `lr-map`. Each anchor holds your own live content, which is never cloned or moved, so its listeners and component state survive camera moves, off-screen hiding, style replacement and map reconnects. Each module opens, moves and closes its own anchor with `open`, `lngLat`, `close()` and a cancelable `lr-close-request` followed by `lr-close`, without affecting other anchors or the map's `anchor` slot.

  - Anchors are placed like the `anchor` slot and follow the camera. They take their own `safeArea` and `boundary`, or the map's `anchorSafeArea` and `anchorBoundary` while those are unset, and stay placed through a `mapStyle` replacement.
  - A `closable` anchor gets a localized close button and closes on Escape. Escape closes the anchor that contains focus first, otherwise the frontmost one. Overlapping anchors are painted with the most recently opened, focused or pressed one in front.
  - Focus moves only to `[autofocus]` content or through `focusContent()`, and returns to where it came from when a focused anchor hides, closes or is removed.
  - `lr-map` gains an `anchors` slot, where a direct child anchor assigns itself. Import `@aceshooting/lyra-ui/components/lr-map-anchor.js` alongside `lr-map.js`; maps without child anchors render, load and behave as before, and the placement code is still loaded only when an anchor opens.

  The additional registration route, map runtime, declarations and consumer/editor metadata require small delivery-budget increases. Only exceeded media-family, initial scoped-loader, unpacked UI, packed/unpacked IDE and packed consumer core ceilings advance to the next 64-byte boundary. Existing passing limits, lazy-import boundaries and measurement settings are retained. The complete non-optional packed consumer graph measures 5,619,706 raw bytes across 57 files; its ceiling advances to 5,619,712 bytes, the next 64-byte boundary, with unchanged peer exclusions and no binary allowance.
- 1e233d8: Add the opt-in `shiftCrossAxis` positioning option to keep a popup inside its clipping boundary along both axes. Map anchors use it to stay fully inside changing safe areas and custom boundaries, keeping their close actions reachable without moving the map camera.
- 1e233d8: Expose `geolocate-control` and `attribution-content` map parts so applications can offset the geolocation group and position bounded credits independently of the compact attribution toggle.

  The map readiness, layout and safe-area corrections measure 343,439 gzip bytes for the media family; its reviewed ceiling advances to 343,488 bytes, the next 64-byte boundary. Other entry budgets remain unchanged.

  The generated editor archive retains all four editor formats and measures 1,701,215 packed and 10,541,676 unpacked bytes with the new parts and safe-area documentation. Its two exceeded limits advance to the next 64-byte boundaries at 1,701,248 and 10,541,696 bytes; file-count and other package limits remain unchanged.

### Patch Changes

- Keep maps ready when a style override targets a layer absent from the selected basemap. Defer its paint, layout and placement until the layer exists, discard obsolete restoration baselines, and retry after style changes while retaining rejection of invalid or conflicting resources.

- 1e233d8: Preserve scoped theme ownership when an element is frozen after its first theme application, so later theme changes still restore the original attributes and token values when the scope is removed.

  The theme entry measures 13,514 gzip bytes with the ownership correction. Its reviewed ceiling advances to 13,568 bytes, the next 64-byte boundary. Other entry budgets remain unchanged.
- 1e233d8: Wait for URL style replacements to commit before reporting map readiness and restoring owned overlays, images and style overrides. URL replacements now rebuild the native basemap instead of diffing it, so unchanged responses also have a reliable completion event. This trades the native style-diff optimization for correct replacement readiness. Pending replacements can also be superseded repeatedly by inline styles without attempting to diff an unloaded basemap.
- e7ed92d: Keep text-only agent messages valid when updating or completing them without structured parts. Explicit part replacements and empty-array clears retain their existing ownership and validation rules.
- 49b43b3: Cancel obsolete file-tree reveals promptly when the listing, source mode, connection, or document changes, preventing stale focus and unresolved reveals during nested expansion.

  The cancellation and selection initialization fixes measure 432,393 gzip bytes in the data family; dialog heading and overlay ownership fixes measure 152,491 in overlays; time-picker focus restoration measures 27,545 initial marginal bytes. Their three breached bundle ceilings advance to the next 64-byte boundaries (432,448, 152,512, and 27,584 bytes), preserving all passing ceilings and measurement settings.

  The corresponding file-tree cancellation documentation measures 1,701,422 compressed bytes in the generated IDE package. Its packed ceiling advances to the next 64-byte boundary, 1,701,440 bytes, without changing required editor formats or any other package limit.
- 49b43b3: Keep heatmap source PNG exports available after a completed resize or theme repaint, while continuing to withhold pending, failed, and obsolete source snapshots.
- 49b43b3: Apply corrected neighbor-list provider pages before rendering so pagination and row actions share the current page without scheduling an unnecessary follow-up update.
- 1e233d8: Retain the mixed runtime observations from comparisons with 30.0.0. Earlier controlled published/current/current/published measurements did not consistently reproduce the initial chart and combobox total-time increases, although three of four comparisons still flagged smaller wait-related metrics. A fresh complete quick Chromium comparison with matched metadata and dependencies reports 11 regressed and 7 improved timing metrics out of 150. Chart total p95 rises from 111.8 to 147.9 ms; table-sort update median rises from 11.5 to 13.7 ms. Additional regressions affect table no-op frame waits and select metadata-update p95. These observed regressions do not establish a performance pass.

  The table's runtime import graph is unchanged. The chart's new late-feature request checks run during untimed setup, with those features disabled in the fixture. Select changes concern initial selection and reset behavior, while positioning changes affect open popups, outside the measured closed-control metadata updates. No changed algorithmic cause was identified for these operations. With seven samples, p95 is the maximum; phase timings include scheduling and frame waits. Those limits do not erase the observations. The deterministic scale checks and the separately required A/B benchmark retain their existing thresholds.
- 1e233d8: Remove redundant closing whitespace from single-line declaration documentation, reducing the unpacked package by 4,076 bytes while preserving public types and editor documentation.
- 1e233d8: Keep closed and offscreen map anchors hidden when applications customize their public part's display layout, including important consumer declarations. Visible anchors retain the application's display styling when restored.
- e7ed92d: Keep map drawing failure handling responsive when the renderer temporarily cannot provide its canvas. Accessibility descriptions release the unavailable canvas and reconnect after the renderer recovers.
- 49b43b3: Avoid a redundant reactive update while closing the time picker and restoring focus to the original segment, while preserving public focus events.
- e487c79: Clear stale slider focus styling when a range-mode change is followed by disablement or a newer focus request, while preserving the current thumb's focus ownership.
- 49b43b3: Keep dialogs suspended while an external modal owns focus, including when a previously hidden dialog becomes visible. Restore referenced heading names when dialogs and drawers open or reconnect without including hidden or inert headings.
- e143d1c: Load the zoom, data-label and annotation add-ons for a chart whose `zoomable`, `data-labels`, `stack-totals` or `annotations` setting is assigned right after it connects, before its charting library has finished loading, instead of leaving them silently unloaded until the setting changes again.
- e143d1c: Keep progressive Markdown streaming active when a rewriting edit discards committed groups while a queued recompute still points past them, instead of freezing the progressive render for the rest of that stream.
- 49b43b3: Preserve an initial selectedOptions assignment until the select has collected its options, while honoring later value writes and retaining declarative form-reset defaults.
- 1e233d8: Prevent an open, closable map anchor from repeatedly updating when inherited text direction changes. Anchors remain responsive when switching between left-to-right and right-to-left layouts.
- @aceshooting/lyra-translations@30.1.0

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
