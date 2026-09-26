---
'@aceshooting/lyra-ui': patch
---

State paint now survives the resting tokens and the pointer:

- `lr-switch`: a checked track now paints `--lr-switch-checked-track-fill` (default `--lr-color-brand`) even when `--lr-switch-track-fill` is set, and the default hover and press mixes start from the checked fill while checked. Previously, setting `--lr-switch-track-fill` repainted the checked track (and its hover and press) in the unchecked colour. If you set only `--lr-switch-track-fill` and relied on the checked track sharing it, also set `--lr-switch-checked-track-fill`. An explicit `--lr-switch-track-hover-fill` / `-active-fill` still applies in both states; for a per-state value, set it from `lr-switch:state(checked)`.
- `lr-chip`: a selected toggleable chip's hover and press wash now starts from `--lr-chip-pressed-bg` instead of the resting `--lr-chip-bg`.
- `lr-checkbox`, `lr-radio` and `lr-tree-item`'s checkbox: a checked (or indeterminate) control keeps `--lr-checkbox-checked-border`, `--lr-radio-checked-border-color` or `--lr-tree-checkbox-checked-border-color` / `-indeterminate-border-color` under the pointer instead of switching to brand. An explicit `--lr-checkbox-hover-border`/`-active-border` or `--lr-radio-hover-border-color`/`-active-border-color` still applies in every state.
- `lr-tree-item`, `lr-prompt-studio`, `lr-pagination`, `lr-test-results` and `lr-env-list`: the hover and press of the selected row, selected version, current page, pressed filter or revealed button now start from that state's token (`--lr-tree-selected-bg`, `--lr-prompt-studio-version-selected-bg`, `--lr-pagination-current-bg` and `-current-border-color`, `--lr-test-results-filter-active-bg`, `--lr-env-list-reveal-active-bg`) instead of its built-in default. Nothing changes unless you set those tokens.
- `lr-trace-tree` and `lr-agent-eval-dashboard`: pressing the already-active row or already-pressed metric now deepens that item's own fill instead of flashing the unselected press colour.
- `lr-video-playlist`: the current item keeps its current border and background tint under the pointer and while pressed, instead of taking the plain item hover.
