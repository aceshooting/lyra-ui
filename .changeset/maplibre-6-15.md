---
'@aceshooting/lyra-map': minor
---

Update the renderer engine to MapLibre GL JS 6.15.0, rebuilt from the reviewed 6.15.0 source with the same asynchronous feature preparation and shared module worker.

- New upstream APIs are exported: `addProjection()`, `removeProjection()`, the built-in `identity` projection and the `{bbox}` tile URL token for maps in a custom planar coordinate reference system (experimental), plus the `CRS`, `TileMatrixSet` and `DragRotateOptions` types.
- The `dragRotate` map option accepts `{around: 'pointer'}` to rotate and tilt around the point under the pointer, and `{around: 'center', movement: 'circular' | 'linear'}`, which replaces the now-deprecated `aroundCenter` option.
- Tiles load faster because point labels in the tile buffer, which the neighbouring tile draws, are skipped; vertical labels rendered with `font-faces` use OpenType vertical forms.
- Fixes: maps no longer stop loading tiles in Safari 26.6 and later after the page was in the background; the camera no longer drops to sea level while terrain under the centre loads; terrain finds its DEM data when the DEM source's maxzoom is below the terrain tile zoom; `load` and `idle` no longer fire early when one tile fails; Brahmic-script labels (Devanagari, Thai, Telugu) no longer mix fonts or drop letters with a glyphs URL; line layers no longer show a grid along tile borders in overzoomed tiles with extents above 4096; globe dragging keeps full precision; `setWorkerUrl()` no longer misreads a `.cjs` marker in a query or fragment.
- The popup close button is built without `innerHTML`.
- The GeoJSON tiling dependency is updated to 6.3.0, so a feature without coordinates appears once `updateData()` gives it some.
