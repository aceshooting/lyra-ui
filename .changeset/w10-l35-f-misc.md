---
"@aceshooting/lyra-ui": major
---

- `lr-tour` keeps a declarative `open` pending until `steps` arrive (assignment order no longer matters) and no longer emits `lr-tour-step-activate` while closed; hosts that relied on activation events for a closed tour must read `activeIndex` directly.
- `lr-media-card frame="plain"` draws an outline on hover and press, using `--lr-media-card-hover-border-color` and `--lr-media-card-active-border-color`.
- `lr-mention-popover` no longer retains the caller's `items` array.
- Lazy composite children: every host settles its own children's first render even when another host started the shared load.
- The `lr-map` guide documents the `pick-mode`, `draw-mode` and `anchor-closable` attributes.
