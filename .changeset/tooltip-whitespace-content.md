---
'@aceshooting/lyra-ui': patch
---

`lr-tooltip` now paints its `content` property, and describes the trigger with it, when the default slot holds only whitespace beside a `slot="trigger"` element written across lines. Previously the template indentation counted as slotted content, so the bubble opened empty and the trigger had no accessible description. Slotted elements or non-whitespace text still take precedence over `content`.
