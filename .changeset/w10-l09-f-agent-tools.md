---
'@aceshooting/lyra-ui': minor
---

- `lr-trace-tree` / `lr-agent-trace`: token counts of 100,000 or more render in compact notation, and the duration, token and cost cells ellipsize (full text on `title`) instead of painting into the next column. Accessible names keep the exact figures.
- `lr-subagent-panel`: under `frame="plain"` the selected run keeps an inline-start rule in `--lr-subagent-panel-selected-border`.
- Script-focused targets in `lr-approval-queue`, `lr-agent-run`, `lr-background-runs`, `lr-subagent-panel` and `lr-tool-param-form` now paint the tokenized focus ring instead of the browser default.
- `lr-permission-grant`, `lr-permission-rules`, `lr-connector-manager` and `lr-background-runs` gain `frame="plain"` and the shared `--lr-panel-frame-bg`, `--lr-panel-frame-border-color`, `--lr-panel-frame-radius` and `--lr-panel-frame-padding` hooks. All four now fill with `--lr-color-surface` by default (previously only `lr-permission-grant` did); set `--lr-panel-frame-bg: transparent` to keep the old look.
- `lr-tool-param-form`, `lr-tool-approval-dialog` and `lr-tool-select-dialog` now carry the shared form-control size ladder, so their text fields (the param-form inputs, the JSON editor and the search field) follow `--lr-theme-form-control-*` and `--lr-form-control-*` radius, padding, height and font-size together. Previously those tokens were not declared in these components, so the param-form inputs only picked them up from a sized ancestor.
- `lr-connector-manager` keeps rows with an unrecognized `status` visible as a neutral "Unknown" row with no action, and omits the kind label for an unrecognized `kind`, instead of dropping them.
- `lr-tool-param-form` clears visited fields and revealed errors when a structurally different `schema` is assigned.
- `clearToolRenderers()` is documented public API (test isolation and hot-module reload).
