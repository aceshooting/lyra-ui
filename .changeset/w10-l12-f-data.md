---
'@aceshooting/lyra-ui': minor
---

- `lr-stat`: a keyboard-focused exact-value stop (headline value, breakdown row, or a linked stat's card link) now shows its exact value on its own line; browsers show no `title` tooltip on keyboard focus.
- `lr-sequence-strip`: the source exact-item button describes its key help with `aria-describedby` and shows it below the button while keyboard-focused.
- `lr-heatmap`: without `sticky-labels`, the hover tooltip is clamped inside the component and flips below a first-row cell instead of hanging past the host edges.
- `lr-word-cloud`: `[part="base"]` pins `overflow-y: hidden` and the drawing shrinks in a definite-height host, so the legend and notes no longer turn the base into a vertical scroller.
- `lr-calendar`: the default unselected-day hover is a neutral step off the surface instead of the selected-day fill, so the hovered day never looks selected.
- `lr-data-grid`: Ctrl/Cmd+C copies rows only when rows are selected and no text selection is live; otherwise the browser's own copy runs. Previously an unselected grid copied every processed row.
- `lr-data-grid`: Enter on a focused column resize separator fits the column to its content, the keyboard form of double-click.
- `lr-data-grid`: the `drag-ghost` preview follows the pointer during a column drag and stays inside the grid box instead of sitting clipped at its static position.
