---
'@aceshooting/lyra-ui': minor
---

- Keyboard focus rings are no longer clipped by a component's own scroll or overflow container: `lr-tab-group` tabs and panels, `lr-segmented` segments, `lr-token-input` remove and edit actions, and `lr-code-block` line gutters draw their ring inside the control, while `lr-widget` actions, `lr-scroller` content, the `lr-chat-composer` actions-row toolbar and `lr-selection-toolbar` leave room for slotted controls' rings. `lr-scroller` items gain that room (the ring width plus offset) at the content's ends.
- `lr-dataset-viewer`, `lr-csv-viewer`, `lr-spreadsheet-viewer` and `lr-data-grid` no longer draw a column divider on the last column, so the frame alone draws the inline-end edge.
- Rotating spinners and the running stripe turn at a constant rate: the defaults of `--lr-tool-call-chip-spin`, `--lr-tool-result-dialog-spin`, `--lr-agent-run-spin`, `--lr-task-list-spin`, `--lr-button-spinner-duration` and `--lr-attachment-chip-spinner-duration` are now `var(--lr-duration-ambient) linear`, as are `lr-tool-call-block`'s spinner and `lr-trace-tree`'s running stripe. New `--lr-trace-tree-stripe-speed` sets the stripe's duration, like `--lr-span-waterfall-stripe-speed`.
- `rail-width`, `min-rail-width`, `max-rail-width` (`lr-app-rail`), `row-height`, `gap` (`lr-dashboard-grid`) and `thumb-width` (`lr-page-rail`) share one converter: a blank attribute is now unset (the default applies) instead of `0`, and `Infinity` stays a CSS string instead of a number.
