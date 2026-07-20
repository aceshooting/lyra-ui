---
"@aceshooting/lyra-ui": minor
---

`lr-table`: the empty state is now addressable, cells can carry a native tooltip, `table-layout` is
settable, and the selected row has its own background custom property.

- Every built-in `<lr-empty>` the table renders carries `part="empty"` and re-exports its own inner
  parts as `empty-base`/`empty-icon`/`empty-heading`/`empty-description`/`empty-actions`, so the
  empty state can be restyled from outside without replacing it. Note that the no-columns and
  no-rows states return the empty element as the shadow root's own root, so `::part(base)` does not
  apply in those two states — only in the filtered-to-zero one.
- A new `empty` slot replaces the built-in empty state wholesale on the two *data*-empty branches
  (no rows at all, and filtered/paginated down to zero). The no-columns branch keeps its own
  `noColumnsHeading` copy and is deliberately not slot-replaceable — it reports a configuration
  problem, not an empty result set.
- New `emptyCompact` property (`empty-compact` attribute) overrides the built-in empty state's
  `compact` density. Left unset it preserves today's per-branch behaviour exactly: spacious for the
  whole-table states, compact for the in-table filtered-to-zero one.
- New `columns[].cellTitle(row)` renders the generated `<td>`'s native `title`, symmetrical with
  `cellStyle`. Returning `undefined` or an empty string omits the attribute entirely rather than
  rendering `title=""`, which would suppress an ancestor's own tooltip, and the attribute is
  suppressed while that cell is in inline-edit mode so the tooltip cannot shadow the editor. Some
  screen readers announce a `<td title>` as the cell's accessible name, so use it only for a longer
  form of what the cell already shows.
- New `layout: 'auto' | 'fixed' = 'auto'` property (reflected) sets a floor for the table's
  `table-layout`. `fixed` applies the fixed algorithm even with no column widths declared; the
  default `auto` still resolves to fixed whenever a column declares a `width` or a drag-resize is in
  flight, since resizing does not work under `table-layout: auto`. Under `fixed` with no declared
  widths the first row determines every column's width — so revealing a `priority`-hidden column
  re-measures all of them — and `columns[].minWidth`/`maxWidth` are ignored by the fixed algorithm.
- New `--lr-table-row-selected-bg` custom property (default `var(--lr-color-brand-quiet)`) recolors
  the `aria-selected` row. Shadow Parts forbids an attribute selector after `::part()`, so
  `::part(row)[aria-selected]` is invalid CSS and the selected row could previously only be
  restyled by overriding the library-wide brand-quiet token. Unset, rendering is unchanged.
