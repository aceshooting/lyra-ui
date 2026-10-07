---
"@aceshooting/lyra-ui": patch
---

Commit pending typed date edits on blur when the browser omits its native change event after an Enter-triggered form reset. Native change followed by blur still commits once, and programmatic replacements discard pending edits without emitting a stale change.
