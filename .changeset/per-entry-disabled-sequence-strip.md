---
"@aceshooting/lyra-ui": minor
---

`<lr-sequence-strip>` items accept `disabled`, so a step that cannot currently be opened stops being
a reachable control that does nothing. Activation emits nothing and roving focus steps past it. An
item that does not set it renders exactly as before.
