---
"@aceshooting/lyra-ui": major
---
lr-tree / lr-tree-item: reassigning `data` (for example to answer `lr-lazy-load` or refresh a badge) no longer clears the rows a user selected: a same-id item refresh re-seeds `selected` only when it sets `selected` explicitly. Migration: to clear or change selection from data, set `selected: false`/`true` on the refreshed items instead of omitting it.
