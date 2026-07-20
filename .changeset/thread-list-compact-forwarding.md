---
"@aceshooting/lyra-ui": minor
---

`lr-thread-list` forwards a `compact` row density

A reflected boolean `compact` (default `false`) that sets `compact` on every data-mode row
`<lr-conversation-item>`, mirroring how `editable` is already forwarded — the one-attribute way to
tighten a whole sidebar, where previously the only lever was styling `::part(row-item-base)` and
`::part(row-item-title)` by hand. The density itself lives on the row item; this property only
forwards it, so both components stay in sync from one implementation.

Slotted mode (empty `threads` *with* real slotted content) is a documented no-op: that mode renders
host-supplied `<lr-conversation-item>`s as-is, so the host sets `compact` on its own items there —
the same division of responsibility slotted mode already has for every other row property.
