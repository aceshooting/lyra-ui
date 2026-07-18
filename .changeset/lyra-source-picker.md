---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-source-picker>`: a checkbox tree/list scoping which sources ground the next answer —
tri-state folders, select-all, `lyra-file-icon` type icons, and built-in search that keeps matching
descendants' ancestors visible. Deliberately not `FormAssociated` (a scoping panel, not a form
control, mirroring `lyra-tool-select-dialog`'s stance) and renders its own `role="tree"` rather than
composing `lyra-tree`, since `TreeItem` has no tri-state checkbox model.
