---
"@aceshooting/lyra-ui": patch
---

`<lr-drawer>` no longer stretches its body to fill the panel and push `footer` to the panel's far
edge. `<lr-drawer>` extends `<lr-dialog>` and had silently inherited the `[part="body"]` growth
`<lr-dialog>` gained for its own `--lr-dialog-height` opt-in; unlike `<lr-dialog>`'s panel, a
drawer's panel is always a definite size, so that inherited rule always took effect instead of only
once a consumer opted in. `<lr-drawer>` now keeps `body` at its natural content size again, matching
its documented, unaffected behavior.
