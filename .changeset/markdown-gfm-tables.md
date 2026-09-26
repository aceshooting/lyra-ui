---
"@aceshooting/lyra-ui": minor
---

`lr-markdown` and `lr-markdown-core`: GFM table cells no longer split words mid-letter. Cells wrap
only between words, even under an inherited `overflow-wrap: anywhere` or `word-break: break-all`,
and a table too wide for the component now scrolls horizontally inside a new `table-wrapper` CSS
part instead of squeezing its columns. The wrapper is one keyboard tab stop (the arrow keys scroll
it) with a localized accessible name from the new `markdownTableRegion` message ("Table"); a table
that fits still fills the width. GFM column alignment (`:--`, `:-:`, `--:`) is now applied. Like a
long code line, a wide table now counts toward the component's minimum content width.
`lr-streaming-text` and `lr-streaming-text-core` forward the new part. Set
`::part(table) { overflow-wrap: anywhere }` to restore the previous wrapping, or
`::part(table) { word-break: keep-all }` to keep a `keep-all` preference inside tables. Raw HTML
tables in the Markdown source and tables from a custom `table` renderer are unchanged; a custom
renderer that wants the scroller wraps its table in the `table-wrapper` markup itself. A
`::part(table) { overflow-wrap: break-word }` workaround for the old wrapping can be removed; kept,
it also reaches unwrapped `part="table"` tables, which have no scroller and would then widen the
whole document.
