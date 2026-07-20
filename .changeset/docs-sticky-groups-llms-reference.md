---
"@aceshooting/lyra-ui": patch
---

Sync the consumer-facing agent reference (`llms/`) with the sticky group-header work on
`lr-virtual-list` and `lr-thread-list`.

- Document `lr-virtual-list`'s `renderStickyGroup`, the `sticky-group` CSS part, and the four
  behaviors a consumer would otherwise get wrong: the band is `aria-hidden` with its focusable
  descendants forced to `tabindex="-1"` (so it is never a second tab stop or a second heading, and a
  focus-delegating custom element inside it must set its own), it is `pointer-events: none` until
  opted back in through `lr-virtual-list::part(sticky-group)`, it is never measured as a row, and it
  stays mounted but hidden above the first group so its scroll inset is measurable before the first
  jump.
- Document that a `groups` entry with an **empty** `label` renders no marker and acts as a pure
  position anchor, and drop the stale claim that `groups` had no visible effect and that its marker
  carried `role="heading"`.
- Document `offsetForIndex()`/`indexAtOffset()`, the `scrollContainer`/`renderedRows` getters, the
  `lr-scroll` event and its `VirtualListScroll` detail type, and add a sticky-group usage example.
- Document `lr-thread-list`'s `stickyGroups` property (attribute `sticky-groups`) and the
  `group-sticky` exported part, including that the real header row keeps the
  `role="heading"`/`aria-level` semantics and the tab order while the pinned copy stays clickable.
