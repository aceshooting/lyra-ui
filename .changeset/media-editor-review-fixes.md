---
"@aceshooting/lyra-ui": patch
---

`lr-image-editor` keeps its Preset and Aspect selects in sync with the applied settings after repeated rotations, moves the crop in the direction of the Crop X thumb in right-to-left layouts, and redraws the preview at most once per animation frame while a slider is dragged. `lr-lightbox` exports the `LyraLightboxDetailsPlacement` type for its `detailsPlacement` property.
