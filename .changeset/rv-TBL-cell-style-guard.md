---
"@aceshooting/lyra-ui": patch
---
lr-table: `cellStyle` values are now checked with the shared CSS guard, so declarations with escapes (such as an escaped `url(`), comments, image functions or unbalanced brackets are dropped instead of reaching the cell's inline style.
