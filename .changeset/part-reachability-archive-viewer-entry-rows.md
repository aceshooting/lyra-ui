---
"@aceshooting/lyra-ui": minor
---

`lr-archive-viewer`: make the virtualized entry rows actually styleable, by this component and by a
consumer.

Entry rows are produced by this component's `renderItem` but committed into the embedded
`<lr-virtual-list>`'s own shadow root, one boundary deeper than a `[part='entry']` selector can
reach — so all five row-level rules were silently inert and the listing rendered as unstyled stacked
text with no row layout, no icon sizing, no truncation and no size column treatment. They now reach
through `lr-virtual-list::part(…)`, and an `exportparts` forwarding declaration makes the same parts
reachable as `lr-archive-viewer::part(entry)` etc. from a consuming stylesheet.

New part `entry-name-dir`: `::part()` cannot be followed by a descendant combinator, so the
directory-row emphasis that used to be written as a descendant selector now targets a second part
name on the name element itself. A directory row's name is `part="entry-name entry-name-dir"`, and
`::part()` matches with `part~=` semantics, so both names select it.
