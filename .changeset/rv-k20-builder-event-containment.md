---
"@aceshooting/lyra-ui": patch
---
lr-condition-builder, lr-graph-query-builder: child controls' `input`/`change`/`lr-input`/`lr-change` and listbox events no longer escape the builder, so its `lr-input` always carries the full model.
