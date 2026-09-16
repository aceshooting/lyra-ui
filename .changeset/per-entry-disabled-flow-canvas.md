---
"@aceshooting/lyra-ui": minor
---

`<lr-flow-canvas>` nodes accept `disabled`, so a locked, read-only or in-progress node can be shown
without being activatable. The node's control renders genuinely disabled, activation emits nothing,
and roving focus steps past it. A node that does not set it renders exactly as before.
