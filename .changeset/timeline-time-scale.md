---
"@aceshooting/lyra-ui": minor
---

`<lr-timeline>`: position items along a real time axis with the new `scale="time"` mode.

The timeline was an evenly-spaced sequence in which `timestamp` was rendered as text but never used
for placement, so a chronology spanning a long period lost the main thing a timeline conveys — two
events weeks apart and the next decades later all looked equidistant, and the shape of the history
was invisible.

- `scale: 'flow' | 'time' = 'flow'` (type `LyraTimelineScale`, exported from the root barrel).
  `'flow'` is today's layout, unchanged and still the default. `'time'` positions each item at its
  true proportion of the range.
- `rangeStart` / `rangeEnd` pin the axis instead of deriving it from the earliest and latest items;
  a reversed or non-finite pair falls back to the derived range.
- `--lr-timeline-time-extent` (default `var(--lr-size-20rem)`) sets the distance to distribute
  along — `block-size` when vertical, `inline-size` when horizontal. Items are absolutely
  positioned, and a percentage against an auto-sized track would resolve to zero.
- An item with no parseable `timestamp` — including one supplied only through the `timestamp` slot,
  which carries no machine-readable instant — keeps document order and is spread evenly, so a
  partially-timestamped list degrades instead of stacking every unknown at the origin.
- Positions are written to each child as a private `--_lr-timeline-item-offset` custom property and
  removed again when switching back to `'flow'`, so the component still never alters its children's
  content or structure.

Scope note: this covers the request's preferred option. Items sharing an instant overlap rather than
being fanned into lanes — the denser case (parallel lanes by category, a brushable/zoomable range,
per-event click events, collision handling) would change this component's deliberately passive,
zero-event contract, so it belongs in a sibling component with its own design, not here.

Reported as lyra-admin request `fr_g8HzriFThmgrv_UbLoY_9A`.
