---
'@aceshooting/lyra-ui': patch
---

- `lr-image-viewer` and `lr-video` panoramas, `lr-embedding-explorer` and `lr-model-viewer` now restyle their WebGL renderer only when a theme attribute or a relevant media query changes, instead of on every attribute change of every ancestor.
