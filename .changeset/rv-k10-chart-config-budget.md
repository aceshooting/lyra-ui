---
"@aceshooting/lyra-ui": patch
---
lr-chart and its typed subclasses: a raw `config` (property or slotted JSON) whose `data` holds around 10,000 values or more no longer silently drops the caller's `options` and leaves gaps at the end of the last dataset; `data`, `options` and `plugins` are now bounded separately.
