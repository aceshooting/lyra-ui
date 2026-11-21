---
'@aceshooting/lyra-ui': major
---

- **Breaking:** `lr-data-grid` names its columns-menu trigger "Columns" through the new
  `dataGridColumns` string (was "Show all columns"). A `strings.showAllColumns` override no longer
  reaches the grid; set `strings.dataGridColumns` instead (`lr-table` still reads `showAllColumns`).
  `npx lyra-ui-migrate --origin=lyra-v31 --check src` reports each grid override, and the removed
  `threadGroupExpand`/`threadGroupCollapse` overrides of `lr-thread-list`, which have no
  replacement.
- **Breaking:** `--lr-embedding-explorer-height` now wins over the `height` property, and `height`
  is no longer written back to the host's public property. Set one or the other.
- **Breaking:** `lr-flow-canvas` no longer emits `lr-selection-delete` for Delete/Backspace while
  `readonly` (including when locked from `lr-flow-controls`).
- **Breaking:** a refused or redirected select request no longer emits `lr-activate` on
  `lr-radio`, `lr-radio-group`, `lr-swatch-picker` and `lr-rating`, matching `lr-segmented` and
  `lr-tab-group`; an arrow key whose request is refused leaves focus where it was.
- `lr-data-grid`: a `<label>`, `area[href]` or `role="link"` element inside a cell now counts as
  nested interactive content, so activating it no longer emits `lr-cell-click` or activates the
  cell.
- `lr-menu`: toggling an enclosing menu's `top-layer` now moves an already open submenu.
- `lr-video`: the poster play button hands focus to the control-bar play button even when 360
  hotspots are listed.
- `lr-button-group` and `lr-control-group`: a non-empty host `aria-label` names the group even
  while `accessibleLabel` is set to an empty string.
- `lr-memory-panel`: promotion buttons whose row text differs only past the shortened name carry
  their row position, so their names stay distinct.
- `lr-mention-popover`: a row whose `disabled` is any truthy value is skipped by the resting
  highlight, like keyboard movement already did.
- `lr-flow-minimap`: a partial wheel notch is dropped when the pointer leaves or the minimap
  disconnects.
- `lr-flow-canvas`, `lr-archive-viewer` and `lr-docx-viewer` reveal source rows, archive entries
  and highlight targets without animation under reduced motion.
- Scroll bodies that stopped overflowing while focused drop their leftover `tabindex="-1"` once
  focus leaves.
- `lr-span-waterfall`, `lr-task-list` and `lr-trace-tree` no longer send a second source request
  when their source runtime first loads.
- Data grids, graphs and rubric forms skip the lazy child registration check while nothing they
  render needs it, and the remaining checks run one query per update.
- `lr-tour`: documents that an `open` declared at mount waits for `steps`.
- `lr-phone-input`: documents that the built-in invalid edge follows `:state(user-invalid)`.
