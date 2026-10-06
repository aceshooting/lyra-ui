---
"@aceshooting/lyra-ui": patch
---
lr-file-tree: an unloaded directory now uses lr-tree's lazy lifecycle (busy spinner and `aria-busy`, one `lr-load-children` per expansion attempt, expansion once children arrive) instead of a disabled "Loading" placeholder row that was counted in the set size and could collide with a real path.
