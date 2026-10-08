---
'@aceshooting/lyra-ui': minor
---

Retrieval, graph and agent-tools follow-ups:

- `lr-retrieval-results` keeps the row inspector's `lr-toggle` inside the list, as it already did for `lr-chunk-toggle`.
- `lr-knowledge-graph-explorer` shows a localized `details-limit` notice when `entityDetails` is too large to keep.
- Score `thresholds` on chunk-inspector, memory-panel and grounding-summary ignore non-finite values and treat an inverted `{ high, medium }` pair as its ordered equivalent.
- `lr-research-progress` renders its empty state through `lr-empty` (part `empty` is now an `lr-empty`).
- `lr-tool-timeline` loads `lr-tool-approval-dialog` on first use, when an entry sets `needsApproval`, instead of at import.
- `lr-json-schema-viewer` passes the selected schema node to `lr-schema-select` by identity instead of re-cloning it.
- Canvas graph drawing allocates no per-node `Path2D` or per-link dash copy.
