---
'@aceshooting/lyra-ui': minor
---

Extend declarative map composition and data-layer styling.

- Document owner-scoped overlay composition, preserve control order within each corner, and support guarded links in custom attribution.
- Add `before`, `minZoom` and `maxZoom` to GeoJSON data-layer rows, preserving generated-layer group order and applying visibility ranges to labels too.
- Add physical label anchors and bounded text-size-relative offsets for point and line labels.
- Add validated vector-layer paint, layout and filter options with a supported expression subset, theme-token colors and atomic admission before native updates.

Existing map camera and immutable-collection changes already require the next major release; these additions introduce no further breaking change.

The deferred map additions increase direct bundles that inline every reachable feature: both autoloaders, the viewers family through GeoJSON viewer, and SSR/all. Their measured gzip sizes are 1,651,344, 1,651,180, 419,654 and 1,661,479 bytes; only these four exceeded ceilings are refreshed with 2% headroom rounded up to a whole byte. Initial-load, CSS, component aggregate and other direct-entry ceilings stay unchanged.
