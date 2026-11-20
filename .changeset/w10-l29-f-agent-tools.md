---
'@aceshooting/lyra-ui': major
---

- `lr-permission-rules`: with `readonly`, each decision now renders as plain text (`part="decision"` is a `span`, not a `select`), so nothing reads as operable. Consumers that queried the readonly `select` should query the part instead.
- `lr-span-waterfall`: status text and duration now show at every container width (beside the bar when wide), and the axis reserves the same meta column; source-mode updates no longer re-measure axis labels unless the view window or locale changed.
- `lr-trace-tree`: the narrow bar-column breakpoint now follows the root font size (`22.5rem`) like every other container rule.
- `lr-activity-feed`: a virtualized body no longer wraps the virtual list in a second 1px scroll region.
- `lr-commit-card`, `lr-test-results`: hover tints on file rows, the files toggle and test names have an inline gutter.
- `lr-terminal`: the jump-to-latest label uses `--lr-color-on-brand`.
- `lr-prompt-studio`: documented that `lr-change-request` also governs an accepted reorder.
