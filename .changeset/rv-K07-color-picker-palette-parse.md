---
"@aceshooting/lyra-ui": patch
---
lr-color-picker: each palette colour is now parsed once when `swatches` is assigned instead of on every render, so dragging with a large named-colour palette no longer probes the DOM per swatch per frame.
