---
'@aceshooting/lyra-ui': patch
---

- Overlays no longer close on Ctrl, Alt or Meta with Escape; a modified Escape stays available to application and system shortcuts.
- Exported CSV and data downloads still release their temporary object URL when the browser blocks the download activation.
- Colour readback for canvas-based components reuses one scratch canvas per document instead of allocating a canvas for every colour.
- Components gated on viewport visibility no longer throw when the visibility observer delivers a malformed entry list.
