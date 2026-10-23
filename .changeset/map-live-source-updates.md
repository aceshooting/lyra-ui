---
'@aceshooting/lyra-ui': minor
---

Add an explicit redraw revision for retained map canvases and bounded local image URLs for image data layers. Paint-only changes repaint idle maps, while mutable owned-layer updates preserve native source, layer and feature-state identity with guarded rollback.

Keep native source options separate from immutable admitted snapshots so image URL updates can succeed without mutating caller data.
