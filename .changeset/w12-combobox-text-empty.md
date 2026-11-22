---
'@aceshooting/lyra-ui': patch
---

`lr-combobox` with `commit="text"`: assigning `value = ''` now means no value, as clearing the text already did, so the placeholder shows again and `required` reports `valueMissing`. The default `commit="value"` keeps `''` as a selectable option value.
