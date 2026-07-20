---
"@aceshooting/lyra-ui": minor
---

`lr-table`: keep focus inside a persistent (`editable: 'always'`) cell editor when the rows are
re-sorted underneath it. Row rendering is keyed by row key, so a re-sort *moves* the editor's
`<input>` node — the typed value rides along, but a DOM move drops focus on its own — so the table
now records the focused editor's cell and restores focus to it after the move. A row that has left
the rendered set entirely (paginated away, filtered out) only clears the record: focus is not yanked
to whichever unrelated row now occupies that position.
