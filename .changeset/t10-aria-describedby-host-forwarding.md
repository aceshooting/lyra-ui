---
'@aceshooting/lyra-ui': patch
---

Fix `lr-heatmap`, `lr-word-cloud`, `lr-voice-picker` and `lr-tool-call-chip` so a host-authored `aria-describedby` now reaches the internal element that owns the accessible role (the canvas/grid in `lr-heatmap`, the SVG in `lr-word-cloud`, the trigger/combobox-input in `lr-voice-picker`, the button in `lr-tool-call-chip`), matching how each component already forwards `aria-label`.
