---
'@aceshooting/lyra-ui': major
---

State paint, forced colors and text-action hit areas.

**Breaking**

- `lr-checkbox` state tokens use the `-color` suffix of `lr-radio`: rename `--lr-checkbox-hover-border`, `-active-border`, `-active-ring`, `-invalid-border` and `-checked-border` to `--lr-checkbox-hover-border-color`, `-active-border-color`, `-active-ring-color`, `-invalid-border-color` and `-checked-border-color`. `--lr-checkbox-group-invalid-border` and `--lr-radio-group-invalid-border` become `--lr-checkbox-group-invalid-border-color` and `--lr-radio-group-invalid-border-color`. Rename the properties in your stylesheets; the old names are no longer read.
- `lr-select` `multiple` chips now look like `lr-combobox` tags: brand-quiet fill (`--lr-select-tag-bg`), `--lr-radius` corners (`--lr-select-tag-radius`), and per-size padding and text. Set `--lr-select-tag-bg: var(--lr-color-surface-raised)` and `--lr-select-tag-radius: var(--lr-radius-xs)` to keep the old chip. Its remove-button hover now defaults to a currentColor tint.
- `--tag-max-size` now defaults to `var(--lr-size-12rem)` on `lr-combobox` too, so combobox tags are capped like select chips. Set `--tag-max-size: var(--lr-size-5rem)` to keep the old cap.
- `lr-token-input` chips round with `--lr-token-input-token-radius` (default `var(--lr-radius)`) and no longer follow `--lr-token-input-radius`.
- `lr-terminal` copy, download and jump-to-latest buttons use the shared agent action chrome, so they are at least `--lr-icon-button-size` and follow `--lr-button-*`.
- `lr-word-cloud` words keep their group colors under forced colors, so they match the legend.

**Added**

- New resting, hover and pressed tokens where a sibling already had them: select tags; checkbox, radio and radio-button rest; slider track, indicator and marker; time-range track and range; chip-group overflow; stepper index, error index and check; table controls; map native controls, pressed controls and marker halo; video controls and poster press; av-player timeline; image-comparer divider; file-input rows and remove button; attachment-chip thumbnail; checkpoint buttons; message-feedback submit and comment; usage-badge; thread-list search; code-block toggle and gutter; markdown copy glyph; agent-tool headers and rows; mind-map links and nodes; source-picker rows; ingestion-queue actions; viewer highlight actions and table-viewer cell actions; xml-viewer attribute syntax colors.
- The voice-picker preview button follows the trigger's border and fill tokens, and the multi-split divider tints on keyboard focus.

**Fixed**

- Under forced colors, pressed, selected and current states stay visible: agent action buttons, eval metrics, artifact views, prompt versions, graph source and spatial rows, map controls, video playlist items and the open conversation row. Splitters, resize handles and divider rules stay visible, attachment upload progress keeps its bar, page-rail heat dots keep their tone with distinct shapes, flow edges and minimap nodes get per-status patterns, and focused text fields show an outline.
- The document-preview active region gets an offset outline, not just a border color.
- Checkpoint, chat-message retry, xml-viewer copy, email-viewer quote and attachment buttons, the av-player rate select and the map legend controls now meet the `--lr-icon-button-size` hit-area floor.
- Hierarchy source rows use the shared hover and press steps and the trace-tree and task-list row tokens.
