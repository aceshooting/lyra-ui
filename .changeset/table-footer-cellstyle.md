---
"@aceshooting/lyra-ui": minor
---

`lyra-table` gains two per-column hooks: `footer(rows)`, rendered in a real sticky-bottom
`<tfoot>` (only when at least one column defines it) -- e.g. a totals row; and `cellStyle(row)`,
applied via `styleMap` directly to the generated `<td>` -- e.g. a computed heat-tint background --
which coexists safely with the existing sticky-column offset styling.
