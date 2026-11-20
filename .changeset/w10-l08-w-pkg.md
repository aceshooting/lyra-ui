---
'@aceshooting/lyra-ui': major
---

- Default entries register rarely rendered children on first use instead of eagerly: the five
  `lr-agent-workspace` details panels, the `lr-table` pager and skeleton, the `lr-data-grid` pager,
  the virtual list and source pager of `lr-chunk-inspector`, `lr-retrieval-results` and
  `lr-ingestion-queue`, the `lr-av-player` transcript list, the `lr-test-results` source pager, the
  `lr-knowledge-base-admin` ingestion queue and the `lr-dashboard-grid` default-cell widget stack.
  `updateComplete` still settles after the child upgrades. Migration: an application that renders
  one of those children itself and relied on a composite entry registering it must import that
  child's own entry (for example `components/lr-pagination.js`).
- Component entries export the named support types their own public signatures use (for example
  `LyraAccordionAppearance` from `lr-accordion.js`, `LyraChartType` from `lr-line-chart.js`,
  `Engine3dPreference` from `lr-video.js`).
- `lr-slider`, `lr-otp-input`, `lr-code-editor` and `lr-signature-pad` accept
  `label-display="hidden"`.
- `lr-background-runs` accepts the active `collecting`, `waiting-input` and `waiting-approval`
  states with their agent-run labels and a Cancel action.
- `lr-table`, `lr-data-grid`, `lr-tree`, `lr-dashboard-grid`, `lr-card` and `lr-stat` share one
  nested-interactive vocabulary: a cell containing `role="link"`, `label` or `area[href]` no longer
  activates its row, and a `tabindex="-1"` element no longer blocks a dashboard drag.
