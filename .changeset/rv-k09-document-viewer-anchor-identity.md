---
"@aceshooting/lyra-ui": major
---
lr-document-viewer: re-assigning the identical `anchor` no longer re-scrolls; the new `scrollToAnchor(target)` repeats a jump. Migration: replace re-assignments meant to repeat a jump with `viewer.scrollToAnchor(anchor)`.
