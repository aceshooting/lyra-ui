---
"@aceshooting/lyra-ui": patch
---

Fixed `<lr-thread-list>` data-mode rows so choosing a `renderActions`-rendered menu action (for
example a consumer's `<lr-dropdown>` containing an `<lr-menu>`) no longer also fires the row's own
`lr-select` and selects/opens the conversation. The row's `lr-select` listener previously reacted to
any `lr-select`-named event that bubbled through the `<lr-conversation-item>`, including one
coincidentally emitted by a `renderActions`-rendered descendant (`<lr-menu>` fires its own
`lr-select` on item choice). It now only treats the event as row activation when it was dispatched
directly on the `<lr-conversation-item>` itself (`e.target === e.currentTarget`), which is how a
real row click/keyboard activation always dispatches it; a descendant's bubbled event is still
absorbed at the row boundary (as before) but no longer re-emitted as the row's own selection.
