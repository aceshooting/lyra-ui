---
"@aceshooting/lyra-ui": minor
---

`lr-page-rail`: make the virtualized page rows actually styleable, by this component and by a
consumer.

Page rows are produced by this component's `renderItem` but committed into the embedded
`<lr-virtual-list>`'s own shadow root, one boundary deeper than a `[part='page']` selector can
reach — so all 13 row-level rules were silently inert and every page button rendered as a raw
browser `<button>` (UA background, UA border, UA padding) instead of the intended rail row. They now
reach through `lr-virtual-list::part(…)`, and an `exportparts` forwarding declaration makes the same
parts reachable as `lr-page-rail::part(page)` etc. from a consuming stylesheet.

`--lr-page-rail-current-bg` becomes live with this fix: it previously documented a background that
nothing applied. It now tints the current page row, and keeps it tinted while the row is hovered so
the current page stays identifiable under the pointer.

`::part()` cannot be followed by an attribute selector, so state variants carry a second part name
in the element's part list instead (`::part()` matches with `part~=` semantics, so both names select
the same element). New parts: `page-current` on the current page button (alongside `page`), and
`heat-dot-accent`/`heat-dot-success`/`heat-dot-warning`/`heat-dot-danger`/`heat-dot-neutral`/
`heat-dot-overflow` on the heat markers (alongside `heat-dot`). The `data-tone`/`data-overflow`
attributes are unchanged.
