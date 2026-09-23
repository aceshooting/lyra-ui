---
'@aceshooting/lyra-ui': minor
---

`lr-color-picker` and `lr-token-input` gain a new `readonly` property, mirroring `lr-input`'s: the committed value stays focusable, selectable/copyable, and submitted with the form, while every value-committing affordance (the color picker's popup, palette, sliders and eyedropper; the token input's draft, remove buttons and inline token editor) is blocked. `lr-color-picker`'s `swatches` entries, `lr-rubric-form`'s category options, and `lr-voice-picker`'s `catalog` entries each gain an optional decorative `icon` field, rendered inert and `aria-hidden` alongside the option, matching the same field already supported by `lr-swatch-picker`, `lr-filter-bar`, and `lr-model-select`.
