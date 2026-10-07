---
"@aceshooting/lyra-ui": patch
---
lr-selection-toolbar: positions itself once per update instead of also reading viewport geometry on every render, and its docs now say to reassign `rect` on `selectionchange` and on scroll.
