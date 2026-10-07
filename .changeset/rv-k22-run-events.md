---
"@aceshooting/lyra-ui": minor
---
`lr-agent-run` and `lr-subagent-panel` request cancellation through `lr-run-cancel`, `lr-agent-run`'s `lr-run-retry` carries `runId`, `lr-background-runs` opens a run through `lr-run-activate`, `lr-agent-eval-dashboard` emits `lr-metric-change-request` and `lr-change-review` emits `lr-change-decision-request`; the old names (`lr-cancel`, `lr-run-open`, `lr-metric-change`, `lr-change-decision`) remain as deprecated aliases dispatched right after.
