---
"@aceshooting/lyra-ui": minor
---

`lyra-table` gains opt-in row selection (`selectionMode: 'single' | 'multiple'`, `selectedKeys`,
`lyra-selection-change`), a built-in filter field (`filterable`, `filterText`, `filter`,
`lyra-filter-change`), controlled pagination through `<lyra-pagination>` (`pageSize`, `page`,
`totalItems`, `paginationMode`, `lyra-page-change`), a `loading` state with an indeterminate
spinner, per-column double-click inline editing (`TableColumn.editable`/`editValue`/`editType`,
`lyra-cell-edit`), and row grouping (`groupBy`, `groupLabel`). All new properties default to
today's exact behavior when left unset.
