---
"@aceshooting/lyra-ui": patch
---
lr-virtual-list: re-committing identical rows (a parent re-render) or measuring newly rendered rows no longer re-derives every row key, and no longer cancels a pending `scrollToIndex()` or `active-item-id` correction.
