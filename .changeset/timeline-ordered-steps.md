---
'@aceshooting/lyra-ui': minor
---

Add `ordered` and `start` to `lr-timeline`. An ordered timeline renders a native `<ol>` and each item's marker becomes a ring around its step number, real text formatted for the effective locale and exposed to assistive technology, in the new `marker-number` part; `start` sets the first number like `<ol start>`. The new `--lr-timeline-marker-number-color` property sets the number colour. `reservations.css` (and `reservationStyles`) now lay out a vertical flow timeline before its definitions load, with markers, rail, floated timestamps, descriptions and CSS-counter step numbers for an ordered timeline, so server-rendered steps no longer shift when the script arrives.
