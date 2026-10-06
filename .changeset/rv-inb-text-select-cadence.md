---
"@aceshooting/lyra-ui": patch
---
`lr-text-select` from `lr-markdown`, `lr-html-viewer` and the other document viewers now fires once when a selection ends: not on every frame while the pointer is still dragging, and not again for a pointer release or keystroke (such as Ctrl+C) that leaves the selection unchanged.
