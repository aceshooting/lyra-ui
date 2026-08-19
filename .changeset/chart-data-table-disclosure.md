---
"@aceshooting/lyra-ui": minor
---

`<lr-chart>` (and every chart subclassing it — bar, line, pie, doughnut, radar, polar-area,
scatter, bubble, histogram) and `<lr-box-plot>` gain `dataTableToggle` (`data-table-toggle`), which
renders a localized disclosure button above the accessible data table.

`showDataTable` was all-or-nothing: the table was either permanently screen-reader-only or
permanently visible, so a sighted reader who wanted the numbers behind a chart could only get them
if the consumer hand-rolled a `<details>` around a duplicated copy of the table. With the toggle
on, `showDataTable` becomes the disclosure's initial state rather than its whole behavior. The
table stays in the DOM in both states, so assistive technology never loses it, and the button
carries `aria-expanded` plus `aria-controls`. A new `data-table-toggle` CSS part styles the
control. Unset, nothing renders and behavior is unchanged.
