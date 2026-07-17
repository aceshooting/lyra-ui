---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-highlight-layer>`: a presentational overlay that paints highlight rectangles
(percent-of-box coordinates) over positioned content — a pdf page, an image, any relatively-positioned
frame. Roving-tabindex keyboard access (ArrowUp/Down/Left/Right honoring RTL, Home/End, Enter/Space),
`aria-current` on the active rect, a one-shot `flash()` emphasis pulse with a reduced-motion static
fallback, and token-mapped tones. Zero dependencies. `lyra-pdf-viewer` adopts it next for per-page
highlight painting.
