---
"@aceshooting/lyra-ui": patch
---

`<lr-radio-group>` now keeps a `value` assigned before its radios carry their own values and selects the matching radio once one arrives, instead of dropping it when the first radio connects. A user selection, a newer host value, a form reset or a restore still replaces the pending value.

`<lr-context-meter shape="ring">` keeps its centre caption inside the ring's hole, and its ring circles no longer inherit the bar shape's band backgrounds, so a contrast check no longer reads an arc's tone as the caption's backdrop.
