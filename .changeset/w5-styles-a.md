---
'@aceshooting/lyra-ui': minor
---

- Forced colors: `--lr-color-border-strong` now maps to `ButtonText`, so the `lr-video` timeline rail and the flow node and status dots keep a visible system-colour paint instead of collapsing into the page.
- `lr-drop-zone` and `lr-file-input` share one size ladder and one forced-colors drag-verdict treatment, so a tier retune moves both together. Rendered values are unchanged.
- New theming tokens with unchanged defaults: `--lr-conversation-item-pressed-bg`; `--lr-code-editor-gutter-bg`, `--lr-code-editor-gutter-color` and `--lr-code-editor-gutter-border-color`; `--lr-retrieval-results-selected-width`.
- Documented that `lr-select`, `lr-checkbox`, `lr-switch`, `lr-radio-group` and `lr-checkbox-group` have no `readonly`, matching their native counterparts.
