---
"@aceshooting/lyra-ui": major
---
lr-color-picker: the `swatches` palette is now one roving `radiogroup` (swatches are `role="radio"` with `aria-checked`, one tab stop, the arrow keys move and select) instead of `aria-pressed` buttons that each take a tab stop, and it is capped at 512 entries (was 10,000). Migration: select palette swatches by `[role="radio"]`/`aria-checked` rather than `aria-pressed`, and split a palette of more than 512 colours.
