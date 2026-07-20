---
"@aceshooting/lyra-ui": patch
---

Fix `lr-thread-list` and `lr-emoji-picker`'s otherwise fully-themed search fields showing a raw
gray browser "x" glyph (with its own hit target and hover behavior, ignoring every token applied to
the field) once non-empty.
