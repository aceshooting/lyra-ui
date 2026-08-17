---
"@aceshooting/lyra-ui": patch
---

Document `<lr-heatmap>`'s flat-property-to-`data` replacement, a 9.0.0 breaking change that shipped
without a changelog entry.

9.0.0 replaced ten independent top-level `<lr-heatmap>` members with a single discriminated-union
`data` property. The removed members are `mode`, `days`, `rowLabels`, `colLabels`, `values`,
`firstDayOfWeek`, `columnX`, `rowY`, `weekdayLabelText`, and `monthLabelText`. They are now fields on
one of the two `data` branches — `HeatmapMatrixData` (`{ kind: 'matrix', rowLabels, colLabels,
values }`) or `HeatmapCalendarData` (`{ kind: 'calendar', days, firstDayOfWeek?, columnX?, rowY?,
weekdayLabelText?, monthLabelText? }`) — united as `HeatmapData` and exported from the package root.

There are no runtime aliases, and assigning a removed member is silent: Lit accepts it as an
unobserved instance property, so the component keeps rendering its default empty grid instead of
erroring. That silence is why this entry exists — the 9.0.0 notes omitted the change entirely, so a
consumer grepping the changelog for `HeatmapMatrixData`, `HeatmapCalendarData`, `HeatmapData`, or any
of the removed member names found nothing and had no way to learn the API had moved.

The `data` shape itself is unchanged and intentional; only the changelog record was missing.
`llms/data.md`'s "9.0 migration" note already carries the full recipe, including the related removal
of the magic `value-label="value"` localization sentinel:

```js
// removed in 9.0.0
el.mode = 'matrix';
el.rowLabels = ['Mon', 'Tue'];
el.colLabels = ['00h', '06h'];
el.values = [
  [1, 2],
  [3, 4],
];

// 9.0.0 and later
el.data = {
  kind: 'matrix',
  rowLabels: ['Mon', 'Tue'],
  colLabels: ['00h', '06h'],
  values: [
    [1, 2],
    [3, 4],
  ],
};
```
