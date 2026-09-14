---
"@aceshooting/lyra-ui": minor
---

`<lr-heatmap>` can turn its legend off.

- `withoutLegend` (`without-legend`, reflected, `false` by default) hides the colour legend, using
  the same name and the same polarity `<lr-chart>` has always used rather than inventing a third
  spelling for the same idea. Turning it on removes the whole row from the DOM — the gradient bar
  or `legendStops` swatches, the endpoint labels, the `valueLabel` caption, the labelled
  `annotations` entries, and the `legend` slot — so the row contributes no layout box and assigns
  no slotted content, instead of being painted and then hidden.
- The legend's own preparation stops with it: `--lr-heatmap-color-steps-gradient`, the custom
  property this component writes onto the host for the legend bar and for nothing else, is not
  written while the legend is hidden, and is removed again if it had been.
- Cells, tooltips, keyboard interaction, selection, and the generated accessible summary are
  unaffected — the summary already names the value label independently of the legend. Leaving
  `withoutLegend` unset reproduces the previous markup exactly, whitespace included.
