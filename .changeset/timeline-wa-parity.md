---
'@aceshooting/lyra-ui': minor
---

`<lr-timeline>` gains `orientation="auto"` (row when the timeline has room, column otherwise),
`marker-placement` (`start`, `end`, `alternate`), `marker-alignment` (`start`, `center`), a `label`
property and the `timeline` part. `<lr-timeline-item>` gains the `opposite` slot and part with
`with-opposite`, the `icon` slot (alias of `marker-icon`) with `with-icon`, and the `connector` and
`timeline-item` part aliases. New custom properties: `--lr-timeline-icon-marker-size`,
`--lr-timeline-connector-color`, `--lr-timeline-connector-width`, `--lr-timeline-connector-gap` and
`--lr-timeline-opposite-size`.
