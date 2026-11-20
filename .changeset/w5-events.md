---
'@aceshooting/lyra-ui': minor
---

- `lr-model-select` and `lr-voice-picker` emit a cancelable `lr-change-request` before a pick or free-text commit, and report every listbox open and close after the first render with `lr-show`/`lr-hide` (cancelable, except a close forced by disabling) and `lr-after-show`/`lr-after-hide`, however `open` changed.
- `lr-combobox` no longer shows the previous query's rows after a source aborts its own current request.
