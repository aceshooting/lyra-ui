---
"@aceshooting/lyra-ui": minor
---

`lyra-chip` gains a `--lyra-chip-pressed-border` custom property so a consumer can set the pressed/selected border color independent of `--lyra-chip-accent` (which also drives the label text color). Falls back to `--lyra-chip-accent`, so existing consumers are unaffected.
