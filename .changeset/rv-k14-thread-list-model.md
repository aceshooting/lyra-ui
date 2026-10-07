---
"@aceshooting/lyra-ui": patch
---
lr-thread-list: no longer rebuilds and rebinds its whole item model on updates that do not change it (selecting a conversation, size, label or error changes), so the internal list keeps its offsets and scroll correction.
