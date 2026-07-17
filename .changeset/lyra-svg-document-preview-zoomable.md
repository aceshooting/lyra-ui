---
"@aceshooting/lyra-ui": minor
---

`lyra-svg-viewer` and `lyra-document-preview` (its image-format path) gain an opt-in `zoomable`
property that wraps the rendered content in an internal `lyra-zoomable-frame` for pan/zoom
inspection, plus display-only `region` anchor-target support (`highlights`, `activeHighlightId`,
`scrollToAnchor()`, event `lyra-highlight-activate`) for percent-unit bounding-box highlights that
scale with the zoom level. `zoomable` defaults to `false` on both, so an inline thumbnail (e.g. in a
chat stream) doesn't unexpectedly grow a focusable zoom-chrome viewport. Previously neither viewer
had any pan/zoom or region-highlighting capability.
