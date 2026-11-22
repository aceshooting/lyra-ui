---
'@aceshooting/lyra-ui': major
---

`--lr-form-control-label-gap` is now the one label-to-field gap in every placement. Besides the
`label-placement="start"` column gap (default `var(--lr-space-m)`), it spaces a label above the
field, in top placement and in a collapsed start row (default `var(--lr-space-xs)`; the control's
own row gap in `lr-radio-group` and `lr-slider`, `0px` in `lr-checkbox-group`). It applies to every
control that takes `label-placement`, plus `lr-segmented` and `lr-file-input`.
`--lr-form-control-label-block-gap` is removed.

## Migration

Run `npx lyra-ui-migrate --origin=lyra-v32` after upgrading: it rewrites every
`--lr-form-control-label-block-gap` to `--lr-form-control-label-gap`. Then review where the
start-column gap was set: a `--lr-form-control-label-gap` declared on a form or a shared ancestor
now also spaces the top labels under it. Move that declaration onto the start-placed controls (for
example `[label-placement='start'] { --lr-form-control-label-gap: … }`) when only the column should
change, and drop a block-gap declaration that the rewrite now duplicates.
