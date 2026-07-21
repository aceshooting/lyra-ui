---
"@aceshooting/lyra-ui": minor
---

Make `lr-reorder-list`'s `lr-reorder` event cancelable: a listener calling `preventDefault()`
holds the move (reflecting `pending` on the affected `lr-reorder-item`) until the host calls the
new `finalizePendingMove()`/`revertPendingMove()` methods — mirroring `lr-confirm-bar`'s cancelable
approve/deny pattern, for hosts that persist the new order asynchronously.
