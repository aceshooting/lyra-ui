---
"@aceshooting/lyra-ui": major
---
Viewers with the shared `anchor` property (`lr-markdown`, `lr-pdf-viewer`, `lr-image-viewer`, `lr-svg-viewer`, `lr-diff-view`, `lr-docx-viewer` and the other document and media viewers) no longer jump again when the identical `anchor` is re-assigned: the same object, its retained copy, or the same highlight id no longer re-scrolls, re-announces "Jumped to…" or fires another `lr-anchor-result`. This stops a re-rendering parent template, which re-commits object bindings on every render, from pulling the viewer back to its anchor. Migration: to jump to the same anchor again, for example when the same citation is activated twice, call `viewer.scrollToAnchor(anchor)`; assigning a different object or id still jumps as before.
