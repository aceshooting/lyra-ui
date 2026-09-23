---
'@aceshooting/lyra-ui': patch
---

Remove settled-closed lr-popover, lr-tooltip, lr-dropdown, lr-popup, lr-mention-popover and lr-export-button panels from layout after their exit transitions, preventing stale popup geometry from creating unexplained scrolling when a container resizes.
