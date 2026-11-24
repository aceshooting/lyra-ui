---
"@aceshooting/lyra-gen": minor
---

Generated nodes can declare `liveReads`, mapping a declared, non-URL property to a pointer into the host-published `lr-gen-view.liveData`; reassigning `.liveData` updates those properties without a new revision or state change, falling back to the node's own props when a value is missing or violates its schema.
