---
"@aceshooting/lyra-ui": minor
---

`lyra-dataset-viewer` now virtualizes through `lyra-virtual-list` (a new `item-role="row"` mode,
mapping to a proper `role="table"`/`role="row"`/`role="rowgroup"` accessibility tree) instead of a
single synchronous `<table>`, lifting its row cap from 1,000 to the shared 10,000-row default every
other tabular viewer already uses. It also gains `cell-range` anchor-target support (`highlights`,
`activeHighlightId`, `scrollToAnchor()`, event `lyra-highlight-activate`) and an imperative
in-document search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`, event
`lyra-search-change`), sharing the same raw-grid cell addressing as `lyra-csv-viewer`, with the
header row always included since this viewer always parses with PapaParse's `header: true`. The
`lyra:dataset` document-viewer registration now declares `capabilities: { anchors: ['cell-range'],
search: true, textSelect: false }`. `lyra-virtual-list` itself gains the underlying
`item-role`/`row-index-offset` properties this required, additive and defaulting to today's exact
`listitem` behavior for every other consumer. Previously a 1,001+ row dataset file failed to load at
all, and there was no way to highlight or search a cell.
