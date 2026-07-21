---
"@aceshooting/lyra-ui": patch
---

Fix `lr-date-input`'s `selectionDirection` getter returning `undefined` instead of `null` before
the internal input has rendered, despite its declared `LyraDateInputSelectionDirection | null`
return type.
