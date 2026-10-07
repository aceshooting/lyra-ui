---
"@aceshooting/lyra-ui": major
---
lr-document-compare: re-rendering a host with the same versions and anchor no longer jumps both panes back to the anchor; re-assigning the identical `anchor` or version object is a no-op. Migration: to repeat a jump to the same anchor, call the new `compare.scrollToAnchor(anchor)`.
