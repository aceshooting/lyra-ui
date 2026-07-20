---
"@aceshooting/lyra-ui": patch
---

Add missing `:hover` to six components (`lr-env-list`, `lr-graph-query-builder`, `lr-rubric-form`,
`lr-chart`, `lr-scroller`, `lr-widget`) whose interactive controls already had `cursor: pointer` and a
correct focus-visible ring but no hover affordance for mouse users; `lr-chart`'s reset-zoom-button also
gains `font: inherit`, which it was missing entirely.
