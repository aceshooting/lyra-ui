---
"@aceshooting/lyra-ui": minor
---

`lr-table`: a persistent (`editable: 'always'`) cell editor binds its `value` as a content attribute
rather than as the `.value` property, so native dirty-value-flag semantics apply — an out-of-band
`rows` update to a cell the user has already typed into no longer replaces the draft they are still
editing, while an untouched editor still picks up a new `rows` value normally. Double-click editors
(`editable: true`) keep the property binding and its deliberate re-assert, unchanged. `lr-cell-edit`
remains the only mutation channel; the table still never mutates `row`.
