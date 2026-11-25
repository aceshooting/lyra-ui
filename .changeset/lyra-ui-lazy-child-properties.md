---
"@aceshooting/lyra-ui": patch
---

A property assigned to a Lyra element after it upgrades, but before its first update, is no longer overwritten by the value it was given while it was still undefined. A lazily registered child such as `<lr-table>`'s pager could otherwise keep a stale `total` of `0` after the table's rows arrived, leaving Next disabled, because the table does not assign a value that has not changed again.
