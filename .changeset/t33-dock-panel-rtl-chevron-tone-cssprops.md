---
'@aceshooting/lyra-ui': minor
---

Fixed `lr-dock-panel`'s collapse-toggle chevron so it mirrors immediately when an ancestor's writing direction changes, instead of staying stale until an unrelated re-render.
Added component-scoped custom properties for retinting `lr-context-meter`'s tone bands, `lr-gauge`'s per-variant fill, `lr-sequence-strip`'s selection ring, and `lr-mention-popover`'s active-row text color, independently of the shared color tokens those components previously read directly.
