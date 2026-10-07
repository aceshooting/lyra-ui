---
"@aceshooting/lyra-ui": minor
---
`lr-source-picker` and `lr-retrieval-results` report a selection change as `lr-selection-change` (`{ selectedSourceIds }` / `{ selectedChunkIds, chunks }`), and `lr-rag-eval-dashboard` reports a metric, slice or run pick as `lr-metric-change-request`, `lr-slice-change-request` and `lr-run-activate { runId, run }`; the old `lr-sources-change`, `lr-select`, `lr-metric-change`, `lr-slice-change` and `lr-run-change` are dispatched right after as deprecated aliases.
