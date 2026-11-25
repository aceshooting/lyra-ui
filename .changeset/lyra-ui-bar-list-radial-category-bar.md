---
"@aceshooting/lyra-ui": minor
---

Three new data components:

- `<lr-bar-list>` ranks rows as horizontal DOM bars with a real label over each bar and a locale-formatted value at the row's end. It takes `items` (`label`, `value`, optional `variant`), `label`, `max`, `sort` (`descending` by default, `ascending` or `none`) and a host-only `valueFormatter`. Rows form a labeled list read as "label value"; the bars are decorative.
- `<lr-radial-bar>` draws concentric SVG progress arcs, one ring per segment (`label`, `value`, optional `max` and `variant`), with an optional visible legend (`with-legend`) and a host `max`. Assistive technology reads a labeled list of "label: value of max".
- `<lr-category-bar>` splits one bar into consecutive threshold ranges (`values`, optional `variants`) with an optional `marker` and boundary labels (`with-labels`). It is a labeled group whose text names the range the marker falls in, or lists every range.

`<lr-sequence-strip>` gains a `label` property that names its list; a host `aria-label` still wins, and the generated category summary remains the name when neither is set.
