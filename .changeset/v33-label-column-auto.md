---
'@aceshooting/lyra-ui': major
---

`label-placement="start"` supports a content-sized label column:
`--lr-form-control-label-inline-size: auto` makes the column as wide as the label text (never wider
than the row), so the `::part(form-control-label)` flex override is no longer needed. The column
token is now the label's flex basis, and the collapse below
`--lr-form-control-label-collapse-inline-size` sets a full-row minimum instead of a full-row basis.
The label is capped at the row's inline size, so a column token wider than the control no longer
overflows it. This covers every control that takes `label-placement`.

## Migration

Remove a `::part(form-control-label)` rule that only set `flex`, `flex-basis` or
`min-inline-size` to size the start column, and set `--lr-form-control-label-inline-size: auto`
instead. With a content-sized column the hint and error start at the row's inline-start edge rather
than under the field. A label column wider than the control is now clamped to it.
