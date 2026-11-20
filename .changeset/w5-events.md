---
'@aceshooting/lyra-ui': minor
---

- `lr-model-select` and `lr-voice-picker` emit a cancelable `lr-change-request` before a pick or free-text commit, and report every listbox open and close after the first render with `lr-show`/`lr-hide` (cancelable, except a close forced by disabling) and `lr-after-show`/`lr-after-hide`, however `open` changed.
- `lr-prompt-input` and `lr-model-settings-panel` keep their embedded pickers' request and popup events inside; `lr-prompt-input` also keeps the pickers' `lr-input` from reaching the host as its own.
- `lr-geojson-viewer` keeps every `lr-map-*` event of its internal map inside the viewer.
- `lr-combobox` no longer shows the previous query's rows after a source aborts its own current request.
