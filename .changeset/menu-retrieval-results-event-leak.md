---
"@aceshooting/lyra-ui": patch
---

Fix `lr-retrieval-results` and `lr-menu` leaking a wrapped child's own event under the wrong
name alongside the documented, consolidated one: `lr-retrieval-results` leaked `lr-virtual-list`'s
`lr-load-more` and `lr-chunk-inspector`'s `lr-chunk-open` (the latter also carrying an
undocumented extra `anchor` field); `lr-menu` leaked `lr-menu-item`'s raw `lr-menu-item-select`
alongside the documented `lr-menu-select`.
