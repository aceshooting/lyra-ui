---
"@aceshooting/lyra-gen": minor
---

`applyViewPatch()` accepts an `insert` operation (`{ op: 'insert', parentId, node, before?, after? }`) that adds a new node under an existing parent, before or after one of its current children or appended last, validated against the parent's catalog children and the same limits, with every untouched sibling keeping its identity.
