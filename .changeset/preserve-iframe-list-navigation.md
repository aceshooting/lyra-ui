---
'@aceshooting/lyra-ui': patch
---

Preserve pending virtual-list navigation when unrelated keyboard events originate in the Window that owns the scroller. Typing letters or pressing horizontal arrow keys in an iframe no longer cancels a distant vertical scroll before measured row positions settle.
