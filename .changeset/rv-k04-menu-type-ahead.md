---
"@aceshooting/lyra-ui": patch
---
lr-menu, lr-menubar: type-ahead matches each item's cached visible label instead of recomputing its accessible name per keystroke (an authored `aria-label` is no longer matched).
