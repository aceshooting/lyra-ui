# @aceshooting/lyra-map

## 2.0.1

### Patch Changes

- 55c733d: - **Breaking:** `lr-agent-workspace` stops the generic control-state events of its built-in children (native `input` and `change`, `lr-change`, `lr-invalid`, disclosure and show/hide events) at its boundary. Child intents such as `lr-load-more`, chunk, citation and tool activation, clipboard and export events keep bubbling out of the host.
    - Migration: listen on the workspace's own events, or read the composer's state through the workspace properties instead of a `change` listener above the host.
  - **Breaking:** `lr-prompt-input` and `lr-model-settings-panel` keep their embedded pickers' request and popup events inside; `lr-prompt-input` also keeps the pickers' `lr-input` from reaching the host as its own.
    - Migration: an `lr-input` listener above `lr-prompt-input` now hears only the prompt's own input; observe the model or voice choice through the host's documented properties and events.
  - **Breaking:** `lr-geojson-viewer` keeps every `lr-map-*` event of its internal map inside the viewer.
    - Migration: render `lr-map` directly when an application needs its map events.
  - **Breaking:** `lr-markdown` routes only unmodified primary link activations.
    - Migration: listen for `click` directly to handle modified or previously canceled link clicks.
  - **Breaking:** `lr-notebook-viewer` no longer loads remote images from markdown cells and keeps nested markdown link activations from reaching the host. No option restores remote image loading.
  - **Breaking:** `lr-archive-viewer` no longer shows the "File"/"Folder" text beside every entry; it stays available to assistive technology through the new `entry-kind` part.
    - Migration: override the visually hidden `::part(entry-kind)` styles to show the text again.
  - `lr-tree` and `lr-file-tree` with a `treeSource` let keys a row does not handle, such as Escape and application shortcuts, reach document and ancestor listeners, so an enclosing dialog or drawer closes on Escape.
  - Editor data and the manifest list the defaults of accessor-backed attributes, such as `lr-chat-composer`'s `actions-layout` and `status`, `lr-audio-visualizer`'s `mode` and `state`, and every `autocorrect`.
  - `@aceshooting/lyra-map`: update the style-spec dependency to 26.9.0; the third-party notices name the installed version.

## 2.0.0

### Major Changes

- e49aab5: Update the modular renderer to MapLibre GL JS 6.19.0. Maps can use the new line,
  fill and raster blend modes, read their request transform with `getTransformRequest()`,
  and supply a Trusted Types policy with `setTrustedTypesPolicy()`. Globe camera math
  loads when a style requests the globe or vertical perspective projection.

  Update direct gesture-handler construction, custom handler animation results, and calls to
  low-level feature query and painter methods as described in the Lyra Map 2.x migration guide.
  Sandboxed pages can use modular workers when the server permits cross-origin module requests.
  The `lr-map` component supports both Lyra Map 1.x (from 1.5.2) and 2.x.

  Load geolocation controls without worker codecs or unused projection solvers.

## 1.5.2

### Patch Changes

- a7eeb1d: Preserve scene-completion observations with the native default overdraw setting and sky rendering before custom layers. Malformed frame flags and actual drawing after the custom layer still prevent an observation.

  The native-frame correction adds 98 unpacked archive bytes with no added files. Its unpacked package ceiling advances to the next 64-byte boundary above the measured archive; the compressed size and file-count limits stay unchanged.
- 9c67698: Prevent a scene replacement from reporting an installed state after a failed native callback retires its layer. Validate the native installation lifetime during reconciliation and commit so later accepted input can recover with a drawable scene.

  The lifetime guards add 204 unpacked runtime bytes to the map archive. Its unpacked size ceiling moves to the next 64-byte boundary above the measured 4,308,548 bytes; compressed size and file-count limits stay unchanged.

## 1.5.1

### Patch Changes

- 2060c47: Update the map style-spec dependency and refresh browser testing, DOM, and AI integration tooling. Preserve accurate coverage for unexecuted callbacks when merging results with the updated browser test runner.

  Keep the supported PapaParse peer range when refreshing development dependencies.

  The updated map style specification adds OKLCH color parsing and interpolation. Its verified archive grows by 2,185 compressed bytes and 5,365 unpacked bytes, with the same 677 files. Advance only the exceeded map size limits to the next 64-byte boundaries.
- 57fb2a3: Refresh dependency versions and generated package artifacts. Qualify the latest optional peers while preserving supported consumer ranges, and update the map style specification dependency to 26.6.0. Rebuild the document engine with Vite 8.3.8 and the reviewed ProseMirror model 1.25.13 dependency.

  Retain coverage counter safeguards and the dev-server dependency security patch with the upgraded test runner.

  The map dependency rebuild changes the archive from 1,051,147 to 1,051,391 packed bytes while reducing unpacked bytes from 4,295,831 to 4,295,701, with the same 677 files. Advance only the exceeded packed ceiling to the next 64-byte boundary, 1,051,392 bytes.
- 303f750: Release map, visibility and canvas observers when scene bridge construction fails during listener registration or input subscription. Failed construction no longer retains callbacks for a bridge the caller never received. Keep releasing the remaining observers and graphics resources when one listener removal throws, preserving the original construction error.

  The required cleanup increases the map archive from 1,051,117 to 1,051,147 packed bytes and from 4,295,602 to 4,295,831 unpacked bytes, with the same 677 files. Advance only the exceeded archive ceilings to the next 64-byte boundaries, 1,051,200 and 4,295,872 bytes.

  The packed MapLibre consumer, including the scene-report validation and native-control guards, measures 2,525,671 raw bytes across 52 emitted files. Set its raw limit to the next 64-byte boundary, 2,525,696 bytes; retain its existing dependency and file checks.

## 1.5.0

### Minor Changes

- e93aebb: Add `createSceneLayer(map, layer, host)` to `@aceshooting/lyra-map/scene` for trusted custom 3D layers. A layer's `create(context)` receives the map's WebGL2 context and geographic services, and each frame provides projection matrices, a shader prelude for Mercator and globe, tile-local encoding and sea-level or terrain-relative altitude resolution through the engine's elevation query. The returned handle reinstalls a fresh instance after style replacement and WebGL context restoration, disposes on removal or signal abort, reports `loading`, `ready` and `unavailable` states, and forwards picking to the current instance. The scene entry now also exports the `MapCustom3dLayer`, `MapLayerContext`, `MapLayerFrame`, `MapLayerInstance` and geographic frame types. The default map entry does not load the bridge.

## 1.4.0

### Minor Changes

- 42909df: Update the renderer engine to MapLibre GL JS 6.16.0, rebuilt from the reviewed 6.16.0 source with the same asynchronous feature preparation and shared module worker.

  - The `transformStyle` map option applies a style transformation from construction on, and later `setStyle()` calls reuse it unless they pass their own.
  - `setMaxBounds()` can constrain one axis only: use `-Infinity` and `Infinity` for an unconstrained longitude range with finite latitude limits.
  - Maps keep loading after a mobile browser shuts down their background workers. On return to the foreground the workers are pinged and, if they do not answer, restarted. Each map then rebuilds its style and fires `webglcontextlost` and `webglcontextrestored`, as after a WebGL context loss. The rebuilt style exists when `webglcontextrestored` fires and keeps images added with `addImage()`. Liveness checks are answered without waiting for pending feature preparation.
  - `importScriptInWorkers()` loads each URL once and loads it again into replacement workers. The `GlobalDispatcher`, `GlobalDispatcherEventType`, `CustomMessageHandler` and `MessageHandler` types are exported.
  - Fixes: a resize between WebGL context loss and its event no longer shrinks the map to one pixel; expired vector tiles reloaded with an unchanged ETag no longer fail; `font-faces` characters keep their glyphs after a glyph range downloads; a constant `line-dasharray` without dash positions no longer throws; `GeoJSONSource.getBounds()` accepts `null` geometries and `updateData()` no longer applies a queued update to a feature that a later call adds again; images added with `addImage()` appear in tiles reloaded across 180°; vector tiles past the source maxzoom load when slicing leaves a one-point line; terrain no longer draws flat at the DEM source's minzoom; `queryRenderedFeatures()` finds all of a GeoJSON polygon whose ring is not closed.
  - The vector tile encoder is updated to 4.3.3.
- 302a6a0: Add the optional `@aceshooting/lyra-map/scene` entry for owned geographic circle markers, with immutable render inputs and explicit visibility, style and disposal lifecycle controls. Terrain sampling retains the full GL state profile. Installation status describes the accepted marker layer without asserting completed terrain sampling or visible pixels.

### Patch Changes

- ee377e2: Avoid requesting an unsupported fog matrix when drawing globe terrain. Globe terrain continues to render without fog, while Mercator terrain retains its existing fog calculation.

## 1.3.1

### Patch Changes

- 074e36a: Prepare map feature families from an isolated metadata snapshot without traversing GeoJSON coordinates, properties, or unused layer payloads. Full style replacement continues to snapshot the complete style.

## 1.3.0

### Minor Changes

- ffb5c06: Add bounded, cancellable prepared source and layer mutations with best-effort rollback, and reset worker bridge tracking for watch rebuilds.

### Patch Changes

- e2701e9: Remove unreachable guards and fallbacks found while bringing the companion packages to full test coverage. Behavior is unchanged.
- 6da5b00: Keep an unused modular renderer import free of worker asset warnings. The Vite plugin supplies the actual worker URL only for configured map consumers; constructing a map without worker setup still reports the configuration error.
- 3cc71c2: Keep mention caret measurements explicitly text-only, avoid excessive backtracking when parsing malformed 3D color values, and escape embedded values when generating map modules.
- d84c719: Validate constrained message, notebook, form, calendar, formatter and provider inputs before rendering or emitting state. Preserve documented fallbacks for unknown lookup keys and reject forged restored files. Bound signature restoration by inspected input positions.

  Validate map resource metadata before rendering, keep explicit source and protocol registration authoritative, and preserve arbitrary valid sprite identifiers across worker transport. Unknown flag codes now consistently resolve to undefined across package entry points.

## 1.2.0

### Minor Changes

- 5112ff8: Update the renderer engine to MapLibre GL JS 6.15.0, rebuilt from the reviewed 6.15.0 source with the same asynchronous feature preparation and shared module worker.

  - New upstream APIs are exported: `addProjection()`, `removeProjection()`, the built-in `identity` projection and the `{bbox}` tile URL token for maps in a custom planar coordinate reference system (experimental), plus the `CRS`, `TileMatrixSet` and `DragRotateOptions` types.
  - The `dragRotate` map option accepts `{around: 'pointer'}` to rotate and tilt around the point under the pointer, and `{around: 'center', movement: 'circular' | 'linear'}`, which replaces the now-deprecated `aroundCenter` option.
  - Tiles load faster because point labels in the tile buffer, which the neighbouring tile draws, are skipped; vertical labels rendered with `font-faces` use OpenType vertical forms.
  - Fixes: maps no longer stop loading tiles in Safari 26.6 and later after the page was in the background; the camera no longer drops to sea level while terrain under the centre loads; terrain finds its DEM data when the DEM source's maxzoom is below the terrain tile zoom; `load` and `idle` no longer fire early when one tile fails; Brahmic-script labels (Devanagari, Thai, Telugu) no longer mix fonts or drop letters with a glyphs URL; line layers no longer show a grid along tile borders in overzoomed tiles with extents above 4096; globe dragging keeps full precision; `setWorkerUrl()` no longer misreads a `.cjs` marker in a query or fragment.
  - The popup close button is built without `innerHTML`.
  - The GeoJSON tiling dependency is updated to 6.3.0, so a feature without coordinates appears once `updateData()` gives it some.

## 1.1.0

### Minor Changes

- cb8c8c5: Refresh dependency resolutions and security overrides, and bound nested pattern processing and numeric formatting in development dependencies. The dependency upgrade command now refreshes transitive dependencies and verifies that required security patches are installed.

  Update the map renderer's GeoJSON tiling dependency, including its optional `worldCoordinates` option and clipping fixes.

  Refresh the document editor's bundled numeric parsing dependency for corrected nonnumeric and leading-zero handling.

## 1.0.0

- Initial modular renderer based on MapLibre GL JS 6.14.0, with dynamically loaded source, layer, projection and terrain features.
- Prepare imperative mutations with `Map.prepareFeatures()` and standalone styles with `prepareStyle()`.
- Preserve synchronous map mutations after preparation and guard asynchronous style changes against replacement and disposal.
- Share feature modules between the renderer and its module worker. Configure the Vite worker plugin or provide an explicit worker URL.
- Export the renderer API, individual controls, stylesheet and worker, with TypeScript declarations and source provenance.
