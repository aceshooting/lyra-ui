---
"@aceshooting/lyra-ui": minor
---

`<lr-map>`: add an optional `group` to `LyraMapLegendEntry`, splitting the legend into sections.

`legend` was one flat array rendered as a single list, so a key covering two layers could not say
which rows belonged to which. Consecutive entries sharing an identical `group` now render as one
section — a visible `legend-group-heading` plus a `role="group"` that heading names through
`aria-labelledby`. The grouping rule is pinned rather than inferred: an entry with no `group` keeps
its **declared** position (never hoisted or sunk), and a `group` that reappears after an interruption
opens a second section rather than reordering rows to merge them.

`group` is caller-supplied data, so it renders verbatim and is never passed through the locale
catalog; it is trimmed, bounded to 256 characters, and a non-string, empty or whitespace-only value
means "ungrouped" rather than an empty heading. Sections are not rows: the 100-row cap and the
`legend-limit` summary still count rows. A grouped legend gives each run its own `role="list"`
(a `list` may only own `listitem`s), while a legend with no groups renders exactly as before. New
`legend-group` and `legend-group-heading` parts.
