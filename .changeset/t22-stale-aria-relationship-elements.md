---
'@aceshooting/lyra-ui': patch
---

Fix components that reflect a host `aria-controls`/`aria-describedby` relationship onto an internal control (including `lr-button`, `lr-icon-button`, `lr-checkbox`, `lr-menu`, `lr-stepper`, `lr-flow-minimap`, `lr-image-comparer`, `lr-model-select`, `lr-file-input` and `lr-attachment-trigger`) so that changing the host attribute to an id that no longer resolves clears the internal relationship instead of leaving it pointing at the previous target.
