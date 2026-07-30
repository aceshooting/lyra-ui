---
"@aceshooting/lyra-ui": patch
---

Centre content that a hit-area floor makes narrower than its own box, in `<lr-calendar>`,
`<lr-citation-badge>`, `<lr-entity-chip>`, `<lr-rating>` and the `<lr-chart>` / box-plot legend
items. These carry the same defect reported against `<lr-widget>`'s view toggle: a flex part with a
`min-inline-size: var(--lr-icon-button-size)` floor (a WCAG 2.5.8 tappable-size requirement, not a
layout intent) but no `justify-content`, so whenever the content is narrower than that floor the
default `justify-content: normal` — resolving to `flex-start` — dumps every pixel of slack on the
trailing side.

`<lr-calendar>` was the most visible: its month-nav buttons hold a single chevron glyph and rendered
**8.8px** off centre, sitting right next to a symmetric month title. `<lr-citation-badge>` left its
one- or two-digit number hugging the badge's leading edge, and `<lr-entity-chip>` did the same to a
short entity label inside an otherwise symmetric pill.

Adding `justify-content: center` only changes rendering in precisely the buggy case: once content
already fills or exceeds the floor there is no slack left to redistribute and the declaration is a
no-op, so every component whose content was already wide enough renders exactly as before. The chart
legends were checked for the overflow case specifically — long series names wrap rather than
overflow, and both legends are wrapping horizontal rows, so per-item centring cannot make a column
of items ragged.

The sweep also cleared roughly ten other parts carrying the same floor where `flex-start` is
correct — full-width header and list rows, whose content should start-align regardless.

Rendered-geometry regression tests (measuring the glyph's centre against its button's) cover
`<lr-widget>` and `<lr-calendar>`; both reproduce the offset without the fix, the widget one at the
same 4.5px the report cited.
