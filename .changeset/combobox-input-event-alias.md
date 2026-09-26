---
'@aceshooting/lyra-ui': minor
---

`lr-combobox` now exports a `LyraComboboxInputEvent<Multiple>` type alias from the package root, matching `LyraComboboxChangeEvent` and mirroring `<lr-select>`'s own `LyraSelectChangeEvent`/`LyraSelectInputEvent` pair. Combobox has no dedicated `lr-input` custom event, so the new alias types its native `input` listener (`InputEvent | CustomEvent<...>`) instead.
