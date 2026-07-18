---
"@aceshooting/lyra-ui": minor
---

New `lr-control-group` primitive: a responsive layout wrapper (`role="group"`, `flex-wrap: wrap`,
`align-items: center`) for a row of mixed form controls and action buttons — a segmented switcher
beside a select and an export button, for example. Distinct from `lr-button-group` (which
stretches uniform-height buttons to a shared row height): `lr-control-group` centers children of
differing intrinsic heights instead, since it makes no assumption about child type. Gap is
themeable via `--lr-control-group-gap`.
