---
"@aceshooting/lyra-ui": minor
---

`lyra-virtual-list` gains a public `scrollToIndex(index, { align, behavior })` method: scrolls a
specific row into view (`align: 'start' | 'end' | 'auto'`, reduced-motion-aware `behavior`) without
the `aria-current`/"active row" side effect of the existing `active-id` property. In
`row-height="auto"` mode, a far-off target's estimate-based offset is corrected with a single re-scroll
once the row's real height is measured. Previously there was no way to programmatically scroll to a
specific row at all except by driving `active-id`, which also marks that row as the current selection —
a streaming transcript's own stick-to-bottom auto-scroll has nothing to do with "selection."
