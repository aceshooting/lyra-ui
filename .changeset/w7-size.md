---
'@aceshooting/lyra-ui': patch
---

- `lr-chart-3d`, `lr-embedding-explorer`, `lr-video` and `lr-image-viewer` panoramas now build the style they pass to their optional 3D renderer through one shared resolver. The resolved values are unchanged.
- `lr-chart` canvas keyboard navigation for ordinary and spatial data now uses one implementation. Key handling is unchanged.
