---
"@aceshooting/lyra-ui": minor
---

`lyra-spreadsheet-viewer` and `lyra-csv-viewer` gain `cell-range` anchor-target support
(`highlights`, `activeHighlightId`, `scrollToAnchor()`, event `lyra-highlight-activate`) and an
imperative in-document search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`,
event `lyra-search-change`) — identical on both viewers, addressing cells by the same 1-based raw
grid (header row included) an A1 reference already implies. Spreadsheet's search/anchor resolution
additionally spans every sheet, switching `lyra-tabs` as needed. Both registry entries now declare
`capabilities: { anchors: ['cell-range'], search: true, textSelect: false }`. Previously there was
no way to highlight or search a specific cell/range in a rendered spreadsheet or CSV file.
