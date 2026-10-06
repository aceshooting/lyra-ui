---
"@aceshooting/lyra-ui": patch
---
lr-tree and lr-file-tree: a data refresh now keeps unchanged rows on their existing item objects, so moving the selection in lr-file-tree (or any refresh that changes a few rows) re-renders only the rows that actually changed instead of every visible row.
