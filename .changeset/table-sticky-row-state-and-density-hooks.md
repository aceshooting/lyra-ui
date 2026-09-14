---
"@aceshooting/lyra-ui": minor
---

Fix `<lr-table>` sticky columns hiding row state, and add cell density hooks.

A `sticky` column's header/body cells hardcoded an opaque `background: var(--lr-color-surface)`,
while striped, selected, hovered, and pressed row fills were declared only on `[part='row']` — so a
striped, selected, hovered, or actively-pressed row visually broke at the sticky column, showing a
flat surface instead of the rest of the row's fill. Each row-state rule now also writes its
background to a private `--_lr-table-row-bg` custom property, which the sticky cell/header rule
reads back (`background: var(--_lr-table-row-bg, var(--lr-color-surface))`); custom properties
inherit from `[part='row']` down into its own `<td>` descendants, so a sticky body cell now shows
the same fill as the rest of its row. A sticky header cell never sits inside `[part='row']`, so it
is unaffected and keeps its existing plain-surface default — including a sorted-and-sticky header,
which still renders exactly as before. `--lr-table-row-selected-bg` and `--lr-table-row-stripe-bg`
now reach a row's `sticky` cell too; the heat-tint (`--lr-table-heat-t`) and forced-colors rules are
unchanged.

Also adds two new themeable hooks for cell density: `--lr-table-cell-padding` (default
`var(--lr-space-s)`), which now backs the header cell, body cell, and row-total cell's padding, and
`--lr-table-cell-padding-compact` (default `var(--lr-space-xs) var(--lr-space-s)`), the same hook
for the group-header cell and the footer cell — kept as a second, independent token rather than
flattened into the first, so their existing tighter block/inline shorthand is preserved rather than
forced onto every other cell. `--lr-table-font-size` (default `inherit`) now backs the `<table>`
element's font size, leaving the rest of the font shorthand (family, weight, etc.) inheriting from
the host as before. All three default to today's exact hardcoded values, so an unstyled table is
unchanged.
