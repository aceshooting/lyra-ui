---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-test-results>`: a pass/fail suite summary with visible (never color-only) per-status
counts, `aria-pressed` status filter toggles, and failure rows that auto-expand by default and can
host a slotted `detail-{testId}` diff/code block. Row state (expansion, filter) survives a streaming
`suites` reassignment mid-run, and a run's completion is announced through an internal live region.
