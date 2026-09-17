---
"@aceshooting/lyra-ui": patch
---

Fixed `<lr-reorder-list>` in `controlled` mode so it no longer steals focus back to the moved row
when the consumer has deliberately moved focus elsewhere while an async `finalizePendingMove()` /
host reconciliation is still in flight. Previously the post-move focus restore unconditionally
focused the moved row's move button once the host's re-render settled, even when the consumer had
already moved focus to an unrelated control on the page in the meantime — overriding that
deliberate choice. The restore now only runs when the pre-restore focus was still somewhere inside
this list, or there was nothing meaningful to preserve (nothing focused, or the previously-focused
node was disconnected by the host's own reconciliation); a still-connected external focus target
is left alone.
