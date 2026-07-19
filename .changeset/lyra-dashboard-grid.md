---
"@aceshooting/lyra-ui": minor
---

Add `<lr-dashboard-grid>`, a responsive, keyboard-accessible widget-layout shell: a controlled
`layout: DashboardCell[]` (grid-unit `x`/`y`/`w`/`h` + a widget descriptor) drives a CSS Grid,
composing `<lr-widget>`/`<lr-widget-renderer>` for each cell's default content unless a
light-DOM `[cell-id]` child is authored instead. Pointer drag/resize and Ctrl/Cmd+Arrow (move) /
Ctrl/Cmd+Shift+Arrow (resize) keyboard equivalents both route through the same `collision`-policy
resolution (`'reject'` the default, `'push'`, or `'overlap'`), emitting `lr-cell-move`/
`lr-cell-resize`/`lr-collision`/`lr-layout-change` -- the component never mutates `layout` itself
nor touches `localStorage`/network; the host applies (or ignores) every event and owns persistence
entirely, matching `lr-flow-canvas`/`lr-table`'s own controlled-component convention. Below a
~40rem container allocation (`@container`, not the viewport), cells stack into a single flowing
column instead of shrinking columns unreadably.
