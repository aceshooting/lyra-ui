---
"@aceshooting/lyra-ui": patch
---
lr-tree: the roving tab stop now follows real focus, including focus moved by script (such as lr-file-tree's `revealPath()`), and a programmatic `expand()` or `expandAll()` no longer moves it, so Tab and the arrow keys continue from the focused row instead of an arbitrary expanded branch.
