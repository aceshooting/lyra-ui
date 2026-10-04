---
'@aceshooting/lyra-ui': patch
---

`lr-select`: clearing a single value to `''` that no option claims now shows the placeholder instead of a "not in catalog" badge. An explicit `<lr-option value="">` still matches and shows its label.
