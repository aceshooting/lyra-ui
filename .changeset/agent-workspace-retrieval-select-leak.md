---
"@aceshooting/lyra-ui": patch
---

Fix `lr-agent-workspace` never emitting its documented `lr-retrieval-select` event when a row is
selected in the built-in retrieval results, and leaking the internal `lr-retrieval-results`'s raw
`lr-select` event through under the wrong name instead.
