---
"@aceshooting/lyra-ui": minor
---

`lr-csv-viewer` and `lr-spreadsheet-viewer`: make the documented `cell-highlight` part actually
visible, and reachable from a consumer stylesheet.

Both viewers already emitted `part="cell cell-highlight"` for a cell covered by a `highlights`
entry, but neither had a single CSS rule for it anywhere — a highlighted cell rendered
indistinguishably from a plain one. Highlighted cells render inside the internal
`<lr-virtual-list>`'s own shadow root (they are `renderItem`'s output), so the styling is applied
through `lr-virtual-list::part(cell-highlight)`, using the same outline tokens `lr-dataset-viewer`
gives its own `cell-highlight` so a highlight reads identically across the table viewers.

- New `--lr-csv-viewer-highlight-color` / `--lr-spreadsheet-viewer-highlight-color` custom
  properties (default `var(--lr-color-brand)`) set the outline color; the active highlight sets it
  inline to `var(--lr-color-warning, var(--lr-color-brand))`, so the active match is now
  distinguishable from the other highlighted cells.
- A paired `:focus-visible` rule restores the shared focus ring, which the unconditional highlight
  outline would otherwise swallow on this focusable cell.
- Both viewers now forward `exportparts` for `data-row`, `cell` and `cell-highlight` from the
  internal `<lr-virtual-list>`, so `lr-csv-viewer::part(cell)` and friends reach the real rendered
  rows instead of matching nothing.
