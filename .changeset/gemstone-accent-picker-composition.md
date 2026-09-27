---
'@aceshooting/lyra-ui': patch
---

Documented `gemstoneAccentPicker`, the canonical accent selector composed from `lr-icon-button`, `lr-popover` and `lr-swatch-picker mode="gemstone"`. It pairs a glowing current-gem trigger styled with `gemstoneSelectedGlyphStyles` with a compact popover holding one localized "Gemstone: name" caption and all nine gemstones in one row: 28px targets with 4px gaps, or 24px targets with 2px gaps below 30rem. It is a documented pattern, not a new tag. The picker stays controlled through `value` and `lr-change`, and the application keeps applying and persisting the accent. The Swatch Picker Storybook page renders the composition live.
