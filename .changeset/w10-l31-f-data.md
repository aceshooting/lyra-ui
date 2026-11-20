---
'@aceshooting/lyra-ui': minor
---

- `lr-pagination`: the compact page-jump input now follows `appearance` and `--lr-pagination-control-bg` / `--lr-pagination-control-border-color` like the buttons.
- `lr-flow-minimap`: the focusable viewport control is `role="application"` so screen readers pass its keys through.
- `lr-data-grid`: the columns-menu trigger is named "Columns" through a new `dataGridColumns` string (was "Show all columns"); a `strings.showAllColumns` override no longer reaches the grid, set `strings.dataGridColumns` instead.
- `lr-data-grid`: internal `frozenArray` helper renamed `freezeSnapshot` (no public surface).
- `lr-table`: sticky cells show the editable hover/press fill and the heat tint instead of the opaque row fill.
- `lr-flow-canvas`: Space while choosing a keyboard-connect target no longer scrolls the page and commits like Enter.
- `lr-env-list`: the copy button drops its `aria-label` while the visible "Copied"/"Copy failed" text shows, so the visible label names it.
