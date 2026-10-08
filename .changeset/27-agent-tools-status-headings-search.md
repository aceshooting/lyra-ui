---
'@aceshooting/lyra-ui': major
---

Agent-tools consolidation. Migration notes:

- `ToolCallStatus` and `ToolResultStatus` are removed; import the single `ToolStatus` union instead (`'pending' | 'running' | 'success' | 'error' | 'denied' | 'incomplete'`), also exported from the root barrel. The tool-call chip, result dialog, result view, timeline and block now share one status keyframes fragment (`lr-tool-status-spin` / `lr-tool-status-pulse`); the public `--lr-*-spin` hooks are unchanged.
- `lr-task-list` and `lr-prompt-studio` now default `heading-level` to `none`, matching `lr-result-card`; set `heading-level="3"` / `"2"` to keep the previous semantic headings.
- `lr-prompt-studio` and `lr-context-inspector` honor `label=""` verbatim instead of falling back to the heading or localized default.
- `lr-tool-approval-dialog` now carries `waitUntil(promise)` on `lr-approve-request` / `lr-deny-request` (`lr-deny-request` detail is `{ waitUntil }` instead of `null`) and emits `lr-decision-settled`, like `lr-confirm-bar`.
- `lr-eval-dataset`'s search field is now a composed `<lr-input type="search" clearable>`: the `--lr-eval-dataset-search-*` custom properties are removed (use `--lr-input-*` / `--lr-form-control-*`), `search-input` is the `lr-input` host, and the native input and clear button are exposed as `search-input-field` and `search-clear`.
- `lr-permission-grant` decision buttons and `lr-connector-manager` action buttons are now `<lr-button>`s; parts `decision` / `action` are the button hosts (new `decision-base`, `decision-label`, `action-base`, `action-label`).
- The duplicate `evaluationRunStatusIdle`, `evaluationRunStatusWaitingInput`, `evaluationRunStatusWaitingApproval` and `evaluationRunStatusCancelled` locale keys are removed; `lr-evaluation-run` uses the `agentRunStatus*` keys.
- `lr-terminal` snapshots its line list once per render instead of once per write.
