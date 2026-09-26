---
'@aceshooting/lyra-ui': minor
---

`lr-model-select`, `lr-voice-picker`, `lr-code-editor`, `lr-emoji-picker` and `lr-color-picker` now adopt the shared `--lr-form-control-focus-shadow` hook alongside the other field-shaped controls: each paints it as a `box-shadow` on its own primary surface (the trigger/combobox row for the pickers, the editor frame for `lr-code-editor`, and the search field for `lr-emoji-picker`) while focused, additive to the existing focus outline and border. `lr-model-select` and `lr-voice-picker` also gain `--lr-model-select-trigger-hover-border-color` / `--lr-voice-picker-trigger-hover-border-color`, matching the shape of each control's existing resting and open-state border tokens, so the hovered (and, on `lr-voice-picker`, pressed) trigger border is independently overridable. Nothing changes unless one of these tokens is set.
