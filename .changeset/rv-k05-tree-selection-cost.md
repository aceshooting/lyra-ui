---
"@aceshooting/lyra-ui": patch
---
lr-tree: `expandAll()` and `collapseAll()` on large trees no longer walk the whole hierarchy once per toggled branch, and a selection click no longer serializes every node's state twice.
