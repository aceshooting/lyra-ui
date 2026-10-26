---
"@aceshooting/lyra-ui": minor
---

Expose map control container, corner, native icon and attribution-link parts, geolocation state
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
