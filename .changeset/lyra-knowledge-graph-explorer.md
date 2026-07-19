---
"@aceshooting/lyra-ui": minor
---

Add `<lr-knowledge-graph-explorer>`, an orchestration-level knowledge-graph surface composing the
existing `lr-graph` canvas with entity search, type filters (via `lr-graph-legend`), neighborhood
expansion, pinned nodes, path finding between pins (via `lr-path-strip`), node selection, and a
node-details popover (via `lr-popover.showAt()` and `lr-entity-card`/`lr-neighbor-list`). Composes
existing primitives rather than re-implementing graph rendering. New events `lr-path-request` and
`lr-pin-change`; every composed primitive's own event (`lr-node-click`, `lr-node-expand`,
`lr-selection-change`, `lr-community-click`, `lr-relation-activate`, etc.) bubbles straight through
unmodified.
