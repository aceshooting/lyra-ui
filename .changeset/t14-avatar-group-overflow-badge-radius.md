---
'@aceshooting/lyra-ui': minor
---

`lr-avatar-group`'s overflow badge action surface is now a floor, not a cap: at the default size
and at `size="l"`/`"xl"` the "+N" hit area grows to fully contain its own avatar-sized painted
disc instead of clipping it, while still keeping its `--lr-icon-button-size` minimum at every
tier. `lr-avatar` and `lr-avatar-group` also gain `--lr-avatar-radius` and
`--lr-avatar-group-radius` custom properties, so the corner radius is retunable without a
`::part()` rule, defaulting to today's exact per-`shape` rendering.
