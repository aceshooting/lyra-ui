---
'@aceshooting/lyra-ui': major
---

- `lr-dashboard-grid`: under `dir="rtl"` Ctrl/Cmd+Shift+Arrow resize now follows the visual arrow direction like Ctrl/Cmd+Arrow move (ArrowLeft widens, ArrowRight narrows). Consumers who documented the old RTL resize keys should update their help text.
- `lr-virtual-list`: the `active-item-id` row now paints a background, themable via `--lr-virtual-list-active-row-background` (set to `transparent` to opt out).
- `lr-carousel`: clamping the active slide no longer writes state from `updated()`.
- `lr-card`: `actionable` and `href` cards ignore the click that ends a text selection.
- `lr-tab-group`: the selected-tab underline overlap follows `--track-width`.
