---
"@aceshooting/lyra-gen": minor
---

`lr-gen-view` gains `elementForNode(nodeId)`, returning a generated node's rendered element in the current revision (stable across revisions and keyed reorders), and documents the `data-gen-id` and `data-gen-type` attributes every rendered element carries, so hosts can highlight, scroll to or annotate a node without inferring it from DOM order.
