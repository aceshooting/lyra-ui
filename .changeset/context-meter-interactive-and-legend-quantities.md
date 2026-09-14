---
"@aceshooting/lyra-ui": minor
---

`<lr-context-meter>` becomes a filter control when you ask it to, and its legend can show the
numbers it stands for.

- `interactive` (reflected, `false` by default) turns every band and every legend row into a real
  button that emits the cancelable `lr-segment-activate` (`detail: { index, label, value }`). The
  ring's arcs carry `role="button"` with their own tab stop and Enter/Space handling, since an SVG
  shape cannot be a native button. This is what a part-to-whole bar above a grid has always been
  asked to do — click the band, narrow the grid — and it previously required hand-rolling the strip,
  its colours and its accessible semantics.
- `selectedIndices` renders `aria-pressed="true"`/`"false"` on the band and its legend row, plus a
  `segment-selected`/`legend-item-selected` part token and the
  `--lr-context-meter-selected-ring-color`/`-width` hooks. A filter toggle with no pressed state
  cannot be reported as on or off by assistive technology, which is why activation alone was not
  enough. Uncontrolled by default — an activation nobody vetoes toggles the index — and
  `preventDefault()` on `lr-segment-activate` hands the selection entirely to the consumer. A
  `bar`-shape band and a legend row mark the selection with an inset ring rather than an outline,
  so it composes with the hover, press and focus-visible outlines instead of being replaced by them
  the moment the user operates the filter; a `ring`-shape arc has no box of its own, so it thickens
  in place (`--lr-context-meter-selected-arc-stroke`) rather than painting an outline that would
  trace the whole ring identically for every selected arc.
- In that mode, and only in that mode, the legend leaves `aria-hidden` so a keyboard or
  screen-reader user can reach the rows, and the visually-hidden `[part="segment-list"]` steps
  aside because the buttons already expose the same label/count pairs with their pressed state
  attached.
- `legendDisplay` (`legend-display`) accepts `label` (the default, byte-identical to before),
  `label-value`, `label-percent` and `label-value-percent`, rendering `[part="legend-value"]` and
  `[part="legend-percent"]` spans. The share is the same clamped ratio the bar or ring paints, so
  the key can never disagree with the band it stands for, and both numbers are formatted through
  `effectiveLocale`. Folding a count into `segment.label` instead — the only workaround before —
  also pushed it into the hover title and the visually-hidden breakdown, where a screen reader
  heard the number twice.

Unset, every one of these leaves today's pure-visualization behaviour unchanged: no buttons, no
events, and an `aria-hidden` legend of labels.
