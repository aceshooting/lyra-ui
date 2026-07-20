---
"@aceshooting/lyra-ui": minor
---

Add consumer-settable CSS custom properties for state-styled surfaces in the data and agent-tools
families that previously took their color straight from a library-wide `--lr-color-*` token with no
component-scoped indirection. Because CSS Shadow Parts forbids an attribute selector after `::part()`
(`::part(row)[aria-selected]` is invalid), these states could only be restyled by hijacking the
shared token, which repaints everything else that reads it. Each new property uses an inline
`var()` fallback to its old token value, so an unset consumer renders byte-identically to before:

- `lr-data-grid`: `--lr-data-grid-row-selected-bg` (selected row background).
- `lr-env-list`: `--lr-env-list-reveal-active-bg`, `--lr-env-list-reveal-active-border` (pressed
  reveal toggle background/border).
- `lr-flow-node`: `--lr-flow-node-selected-border` (selected card border color).
- `lr-flow-canvas`: `--lr-flow-canvas-node-current-outline-color` (current node outline color).
- `lr-artifact-panel`: `--lr-artifact-panel-view-active-bg`, `--lr-artifact-panel-view-active-color`
  (pressed preview/code toggle background/text).
- `lr-test-results`: `--lr-test-results-filter-active-bg`, `--lr-test-results-filter-active-border`,
  `--lr-test-results-filter-active-color` (pressed status filter toggle).
- `lr-span-waterfall`: `--lr-span-waterfall-row-active-bg` (active row background).
- `lr-trace-tree`: `--lr-trace-tree-row-active-bg` (active row background).
- `lr-agent-trace`: `--lr-agent-trace-handoff-active-bg` (active handoff quick-jump entry background).
- `lr-policy-summary`: `--lr-policy-summary-count-allow-color`,
  `--lr-policy-summary-count-deny-color`, `--lr-policy-summary-count-needs-review-color` (per-state
  count text colors).
