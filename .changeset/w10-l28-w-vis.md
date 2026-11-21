---
'@aceshooting/lyra-ui': patch
---

- `lr-node-palette`, `lr-tree-item` and `lr-flow-controls` no longer read the undeclared `--lr-color-surface-hover` token; the pressed fill of a node-palette item now follows `--lr-node-palette-item-hover-bg`.
- `lr-tool-select-dialog` sizes the checkbox row (not the control owner) so long tool names no longer compete with the box for width.
- Hover and press fills now ease on chat-message retry, message-feedback submit, thread-list group toggle, checkpoint buttons, timeline cluster count, card, tab and embedding-explorer points.
- Start/end adornments in input, time-input, date-input, chip and badge no longer shrink or clip under long labels.
- Long unbroken prompt-studio version labels and node-palette item labels wrap inside narrow columns.
- Internal style dedup: shared disclosure chevron and dialog backdrop fragments, merged multi-split and document-library rules, shared visually-hidden in spinner.
