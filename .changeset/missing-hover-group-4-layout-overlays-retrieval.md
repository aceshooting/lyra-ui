---
"@aceshooting/lyra-ui": patch
---

Add missing `:hover` to six components (`lr-carousel`, `lr-dashboard-grid`, `lr-callout`,
`lr-memory-panel`, `lr-neighbor-list`, `lr-path-strip`) whose interactive controls already had
`cursor: pointer` and a correct focus-visible ring (where applicable) but no hover affordance for
mouse users.
