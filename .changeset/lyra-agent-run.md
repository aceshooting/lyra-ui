---
"@aceshooting/lyra-ui": minor
---

New `<lr-agent-run>` component: the top-level shell for one `AgentRun` (from `@aceshooting/lyra-ui/ai/types`) -- lifecycle-status badge, elapsed time, current step, model/cost summary, and built-in Cancel/Retry controls in a header, plus four named composition slots (`tasks`/`tools`/`reasoning`/`output`) for the run's actual content. Composes `lr-generation-status` for the live elapsed-time ticker while a run is in progress, `lr-usage-badge` for the cost summary, `lr-task-list` for the `tasks` slot's default content (mapped from `run.steps`), and `lr-badge`/`lr-empty` for the status pill and empty state -- no new step-rendering logic. Emits `lr-cancel`/`lr-retry` (`CancelEventDetail`/`RetryEventDetail`) rather than cancelling or retrying anything itself.
