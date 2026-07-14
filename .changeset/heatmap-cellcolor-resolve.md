---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-heatmap`'s `cellColor` hook silently rendering solid black when it returns a CSS custom property or other non-literal color (e.g. `color-mix(...)`) — the value is now resolved via a cached, hidden probe element before being assigned to the canvas `fillStyle`.
