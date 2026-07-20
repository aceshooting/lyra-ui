---
"@aceshooting/lyra-ui": patch
---

Fix `lr-color-picker`'s native color swatch -- the directly visible, directly focusable control --
having no hover or focus-visible treatment, so tabbing to it fell through to the browser's raw
default color-input focus ring.
