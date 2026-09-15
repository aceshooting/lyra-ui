---
"@aceshooting/lyra-ui": minor
---

`<lr-thread-list>` gains `itemElement(conversationId)`, the same kind of public row lookup
`<lr-table>`'s `rowElement`/`cellElement`/`expandedContentElement` already document: the rendered
`lr-conversation-item` for one thread's `conversationId` (data mode) or one slotted item's own
`conversation-id` (slotted mode), or `null` when it is not currently rendered — filtered out,
windowed out of the virtualized viewport, removed, or never present. `<lr-table>`'s three lookup
methods and the `data-row-key`/`data-col-key`/`data-expanded-row-key` attributes they resolve were
already shipped as documented stable API; this release adds test coverage confirming they behave
correctly when a row is paginated away, filtered out, or addressed by a key unsafe to interpolate
into a CSS selector.

`itemElement()` exists for the same reason `<lr-table>`'s trio does: reaching rendered row content
to measure it, scroll it into view, or apply a style `::part()` cannot express, without piercing
this component's shadow root (and, in data mode, the nested internal `lr-virtual-list`'s own shadow
root) and walking rendered rows by hand.
