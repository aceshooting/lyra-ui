# @aceshooting/lyra-map

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
