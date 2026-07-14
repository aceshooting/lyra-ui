---
"@aceshooting/lyra-ui": minor
---

`lyra-chip` gains a `--lyra-chip-pressed-bg` custom property (falls back to `--lyra-chip-bg`) so the pressed/selected background can be set independent of the resting background. A toggleable-but-unpressed chip now announces `aria-pressed="false"` instead of omitting the attribute entirely, matching the ARIA Authoring Practices convention for toggle buttons.
