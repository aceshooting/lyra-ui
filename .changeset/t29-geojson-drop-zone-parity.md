---
'@aceshooting/lyra-ui': minor
---

Added a `maxHeight`/`max-height` property to `lr-geojson-viewer`/`lr-geojson-view`, matching every other document viewer's ability to cap its rendered content at a bounded scrollable height, and added a `size` property to `lr-drop-zone`, matching `lr-file-input`'s density scale so the two can be sized consistently in the same layout. Contained the fallback `lr-json-viewer`'s `lr-error`/`lr-copy-error` clipboard-failure events inside `lr-geojson-viewer` instead of letting them leak past it under undocumented names.
