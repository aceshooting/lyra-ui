---
"@aceshooting/lyra-ui": minor
---

`<lr-color-picker>` palette swatches accept `disabled`, so a swatch can be shown as unavailable
rather than silently doing nothing when chosen. The swatch renders genuinely disabled, selection
emits nothing, and keyboard navigation steps past it. A swatch that does not set it renders exactly
as before.
