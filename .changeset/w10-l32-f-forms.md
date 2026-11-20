---
'@aceshooting/lyra-ui': major
---

- `lr-radio-group`: the single `--lr-radio-group-row-gap` token no longer also spaces the options. It now only sets the gap between the label, options and messages (default `0.1` of the control height, matching `lr-checkbox-group`); the new `--lr-radio-group-option-gap` (default `0.2` of the control height) spaces adjacent options. Migration: move any `--lr-radio-group-row-gap` override that was tuning option spacing, or collapsing adjacent `lr-radio-button` segments with `0`, to `--lr-radio-group-option-gap`.
- `lr-otp-input`: segments now step their border on hover (`--lr-otp-input-hover-border-color`); the `--lr-otp-input-active-ring-color` description now says inset ring.
- `lr-locale-picker`: the search field follows `--lr-locale-picker-radius`.
- `lr-date-picker`: preset buttons follow `--lr-date-picker-radius`; the month title scales with `size`.
- `lr-color-picker`: an unparseable text entry stays in the field, flagged `aria-invalid`, until a valid commit, an edit or Escape (themeable with `--lr-color-picker-invalid-border-color`).
- `lr-code-editor`: an empty `resize="auto"` editor keeps `rows` sizing instead of growing by its wrapped placeholder.
- `lr-model-select` / `lr-voice-picker`: closed-catalog type-ahead prevents the default of every key it consumes.
