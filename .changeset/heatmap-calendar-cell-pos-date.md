---
"@aceshooting/lyra-ui": minor
---

`<lr-heatmap>`: `CalendarCellPos` now carries the resolved ISO `yyyy-mm-dd` `date` alongside
`week`/`weekday`. Every calendar-mode position handed to `cellText`, `cellColor` and
`cellInteractive` is populated — **including grid positions with no matching entry in `days`**
(a gap in a sparse calendar still sits on a real calendar day) — so a callback can key off the date
directly instead of re-deriving the grid's `firstWeekStart + week * 7 + weekday` anchor arithmetic,
which was the only way to answer "is this cell in the future?" before.

The date comes from a per-grid cache built once whenever the calendar grid is rebuilt, so it costs
an array read rather than a `Date` allocation per cell per repaint, and it is deliberately excluded
from the internal hover/focus position-equality check so repaint diffs are unchanged. Matrix mode's
`MatrixCellPos` is untouched, and `lr-cell-click`'s detail shape is unchanged.

`date` is a **required** field of `CalendarCellPos`. No API on this component accepts a
`CalendarCellPos` as input — it is purely a callback parameter type — so this is additive for every
supported use; the only way to notice it is hand-constructing a `CalendarCellPos` literal in
TypeScript, which now needs a `date`.
