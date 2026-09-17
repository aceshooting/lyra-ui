---
"@aceshooting/lyra-ui": minor
---

`<lr-combobox>` gains `sync` (unset by default), spelled and shaped identically to
`<lr-dropdown>`/`<lr-popup>`/`<lr-popover>`'s property of the same name. Setting `sync="width"`
copies the trigger's rendered width onto the listbox and drops the previously fixed 12rem-28rem
content-based clamp (keeping only the outer viewport/available-space ceiling), so a full-width
trigger with short option labels gets a listbox that aligns to its own edges instead of floating
narrower in the middle. Left unset, the listbox continues to size to its own content exactly as
before.
