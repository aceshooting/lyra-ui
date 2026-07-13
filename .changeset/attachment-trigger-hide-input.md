---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-attachment-trigger`'s internal hidden `<input type="file">` actually rendering as a
visible, focusable-adjacent element in normal document flow — it now has `display: none` by
default (and a new `hidden-input` CSS part, for the rare integration that needs to override that).
