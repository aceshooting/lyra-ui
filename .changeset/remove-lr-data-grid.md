---
"@aceshooting/lyra-ui": major
---

Remove `<lr-data-grid>`. It was a strict functional subset of `<lr-table>` (same `role="grid"` +
roving-tabindex + sort/select/loading pattern, with none of `<lr-table>`'s filtering, pagination,
inline editing, resize, grouping, expansion, heat-tint, sticky columns, or footers), implemented
independently with no shared code. Use `<lr-table>` instead:

- `DataGridColumn<T>`'s optional `value(row)` becomes `TableColumn<T>`'s required `cell(row)`.
- `<lr-data-grid>`'s `emptyText` string becomes `<lr-table>`'s `emptyHeading`/`emptyDescription`
  pair (rendered via an internal `<lr-empty>`, not a plain text cell).
- `<lr-data-grid>` always mutated `selectedKey` and emitted `lr-selection-change` on row
  click/activation; `<lr-table>` only does that when `selection-mode` is `"single"` or
  `"multiple"` (default `"none"`, presentational) — listen on `lr-row-click` (`detail: { row }`)
  instead if you don't need `<lr-table>`'s own selection bookkeeping.
- `accessibleLabel`/`aria-label` — unchanged; `<lr-table>` reads a plain `aria-label` attribute the
  same way.

`<lr-eval-dataset>` and `<lr-eval-result>` composed `<lr-data-grid>` internally and now compose
`<lr-table>` instead. `<lr-eval-result>`'s public `columns` property changes type accordingly from
`DataGridColumn<EvalRunResult>[]` to `TableColumn<EvalRunResult>[]` — update any `value(row)`
column definitions you pass in to `cell(row)`.
