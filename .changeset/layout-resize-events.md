---
'@aceshooting/lyra-ui': major
---

Align split-panel, multi-split, and dock-panel resize events: `lr-resize-request` can veto each proposed pointer or keyboard step, `lr-resize` reports each accepted step, and `lr-resize-change` reports a committed drag or keyboard step. Dock-panel no longer applies drag movement before requesting it or rolls back a rejected release. Split-panel retains its mirrored `lr-reposition-request` and `lr-reposition` events, and dock-panel retains `lr-resize-input` for existing listeners.
