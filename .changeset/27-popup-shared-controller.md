---
'@aceshooting/lyra-ui': minor
---

`lr-select`, `lr-combobox`, `lr-date-input`, `lr-time-input` and `lr-locale-picker` now share one popup controller for the open/veto/settle sequence and capture-phase outside-press dismissal, so `lr-time-input` and `lr-date-input` settle and dismiss identically. `lr-voice-picker` now takes its `catalog` through the same shared collection boundary as `lr-model-select`: `el.catalog` is a frozen clone of the assigned array, while rendering still admits at most the first 1,024 valid rows.
