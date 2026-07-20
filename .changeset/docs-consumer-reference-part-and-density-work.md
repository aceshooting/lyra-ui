---
"@aceshooting/lyra-ui": patch
---

Sync the consumer-facing agent reference (`llms/`) with the part-reachability, density and composed
-content work that just landed across the viewers, media, retrieval, agent-tools, layout,
conversation and data families.

- Document the newly forwarded and newly named CSS parts on `lr-pdf-viewer`, `lr-archive-viewer`,
  `lr-page-rail`, `lr-notebook-viewer`, `lr-csv-viewer`, `lr-spreadsheet-viewer`,
  `lr-dataset-viewer`, `lr-av-player`, `lr-terminal`, `lr-ingestion-queue`, `lr-neighbor-list`,
  `lr-chunk-inspector`, `lr-retrieval-results` and `lr-activity-feed`, including why row state is
  published as an extra part name rather than an attribute on the part.
- Replace the paragraphs that described `--lr-page-rail-current-bg`,
  `--lr-notebook-viewer-active-bg`, `--lr-av-player-cue-current-bg` and
  `--lr-av-player-cue-active-match-color` as declared-but-inert; all four now take effect.
- Document `--lr-csv-viewer-highlight-color` and `--lr-spreadsheet-viewer-highlight-color`, and
  `--lr-trace-tree-row-active-color` (plus the pairing rule it forms with
  `--lr-trace-tree-row-active-bg`, and the knock-on note under `lr-agent-trace`).
- Document `lr-menu`'s `header`/`footer` slots and parts, the revised Escape/Tab keyboard contract,
  and the narrowed scope of `closeOnEscapeAnywhere`.
- Document `lr-table`'s `columns[].editable: 'always'` persistent editors, `lr-flow-node`'s
  `compact` and `card` part, `lr-flow-controls`' and `lr-chat-composer`'s `appearance`, and
  `lr-conversation-item`/`lr-thread-list`'s `compact`.
