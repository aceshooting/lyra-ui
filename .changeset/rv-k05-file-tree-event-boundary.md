---
"@aceshooting/lyra-ui": major
---
lr-file-tree: the composed tree's `lr-expand`, `lr-collapse`, `lr-after-expand`, `lr-after-collapse`, `lr-lazy-load`, `lr-lazy-change` and `lr-selection-change` events, whose details referenced shadow-internal items, no longer escape the component. Migration: listen to lr-file-tree's own `lr-file-select`, `lr-file-open` and `lr-load-children` events instead.
