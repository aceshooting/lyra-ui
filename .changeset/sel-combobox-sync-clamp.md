---
"@aceshooting/lyra-ui": patch
---

`<lr-combobox>`: a `sync="width"`/`sync="both"` listbox is no longer shortened by
`--lr-popover-viewport-clamp`. The synced rule capped the listbox at
`min(var(--lr-popover-viewport-clamp), var(--lr-positioner-available-inline-size, 100vw))`, and the
clamp's 92vw default resolves below the width of exactly the full-width trigger `sync` exists to
serve -- a 738px trigger in an 800px viewport got a 736px listbox, and the shortfall grows with the
trigger. The synced rule now caps on `var(--lr-positioner-available-inline-size, 100vw)` alone,
matching `<lr-popup>`: a width-synced listbox is anchored to an element already on screen and
measured against the space actually available beside it, so the extra viewport ceiling had nothing
left to protect against, while the available-space term still keeps an over-wide anchor from
pushing the listbox off-screen. An unsynced listbox is unchanged and keeps
`min(--lr-popover-viewport-clamp, --lr-size-28rem)`.
