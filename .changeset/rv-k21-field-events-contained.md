---
"@aceshooting/lyra-ui": major
---
`lr-source-picker`, `lr-retrieval-search`, `lr-retrieval-results`, `lr-chunk-inspector` and `lr-ingestion-queue` no longer let undocumented composed child events escape: the query field's native `input`/`change`, `lr-change` and `lr-clear`, a result row's `lr-chunk-toggle`, and the virtual list's `lr-virtual-scroll`/`lr-visible-range-change`. Migration: `lr-retrieval-search` now reports an edited or cleared query as `lr-input { value }` and a mode pick as `lr-mode-change { mode }` (the property is already updated); listen for those or `lr-search` instead.
