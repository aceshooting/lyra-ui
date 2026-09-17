---
"@aceshooting/lyra-ui": minor
---

`<lr-virtual-list>` gains `row-projection`, an opt-in light-DOM row projection mode, so an
application whose list rows are already styled by its own global stylesheet can adopt virtualization
without rehoming every row rule.

Until now `renderItem`'s output was stamped inside the component's shadow root, so document CSS
could not reach row content: adopting virtualization meant moving a dozen descendant rules per row
into a new custom element or a growing set of custom properties — a stylesheet refactor, paid
exactly by the lists long enough to need virtualizing. With `row-projection="light"` the windowed
rows are rendered into the host's own light DOM and assigned into the shadow viewport through
internal named slots. The component keeps owning windowing, measurement, spacer sizing,
`scrollToIndex()`, the external-scroller mode and the ARIA contract; the consumer keeps owning the
row markup and its cascade, and ordinary document CSS styles a virtualized row exactly as it styles
the same row unvirtualized.

Positioning stays on the shadow-side `[part="row"]` wrapper, which the document cannot select, so
windowing is not overridable by consumer CSS and the whole existing part vocabulary — `base`,
`spacer`, `row`, `group`, `sticky-group` — keeps matching in both modes.

Costs, stated plainly rather than hidden:

- Each projected row sits inside one component-owned wrapper element carrying the reserved
  `data-lr-virtual-list-row` attribute (exported as `VIRTUAL_LIST_ROW_ATTRIBUTE`; the sticky band's
  counterpart is `VIRTUAL_LIST_STICKY_ATTRIBUTE`). Descendant selectors port unchanged; child
  combinators, `:nth-child`, `:first-child` and sibling combinators written against unvirtualized
  markup do not, and `:nth-child` reflects the current window rather than the item index.
- A delegated listener on the host now sees an un-retargeted `event.target`, so
  `closest('[part="row"]')` no longer resolves — use `closest('[data-lr-virtual-list-row]')`.
- The document cascade now reaches row content, including resets that previously could not.
- Per-row light-DOM state does not survive a disconnect/reconnect, because disconnect removes the
  projected rows completely.
- On a hydrated page the first window is shadow-rendered for one task before it swaps into the
  light DOM, so server markup and the first client render agree.

`rowProjection` is `'shadow'` by default. Left unset, every existing list renders byte-identically
and the host's light DOM stays empty.
