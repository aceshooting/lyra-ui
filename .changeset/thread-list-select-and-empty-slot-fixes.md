---
"@aceshooting/lyra-ui": patch
---

Fix two `lr-thread-list` bugs: a row click fired `lr-select` twice (the correct re-emit plus the
original bare event leaking through unstopped), and content slotted into `slot="empty"` rendered
unconditionally instead of only when the list has zero visible threads.
