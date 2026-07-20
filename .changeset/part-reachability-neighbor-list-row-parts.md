---
"@aceshooting/lyra-ui": patch
---

`lr-neighbor-list`: make the virtualized relationship rows and group headers actually styleable, by
this component and by a consumer.

Above `virtualizeAt` the rows are produced by this component's `renderItem` but committed into the
embedded `<lr-virtual-list>`'s own shadow root, one boundary deeper than a `[part='row']` selector
can reach — so every row, node-label, direction, relation, meta and expand-button rule was silently
inert and a large neighborhood rendered as raw browser `<button>`s with no dividers. Each rule now
pairs its plain selector (still correct at/below the threshold) with an `lr-virtual-list::part(…)`
twin, and an `exportparts` forwarding declaration makes the same parts reachable as
`lr-neighbor-list::part(node-label)` etc. from a consuming stylesheet.

Group headers were unstyled whenever the list virtualized: in that path the header is the internal
virtual-list's own `group` part, which this component neither styled nor exported. It is now styled
to match `group-header` and exported under that same name, so grouped rows present identically
either side of the threshold.

The virtualized rows no longer nest a second `role="listitem"`/`part="row"` element inside the
virtual-list's own row wrapper. `renderItem` returns just the row's content, exactly as the
non-virtualized path's own wrapper receives it: the duplicate nesting both reported a `listitem`
inside a `listitem` and made the row's padding and divider border apply twice, since `::part()`
matches at any depth of the target shadow tree.
