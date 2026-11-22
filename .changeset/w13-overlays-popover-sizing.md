---
'@aceshooting/lyra-ui': minor
---

Anchored popup sizing hooks, each defaulting to the current rendering:

- `lr-popover` and `lr-dropdown`: `--lr-overlay-inline-size` (assertive popup width; the maximum falls back to it when no maximum is set) and `--lr-overlay-min-inline-size` (popup floor, capped by the available space), and a `full-width-trigger` attribute that stretches the host, the `trigger` part and the slotted trigger to the container width.
- `lr-popover`: `--lr-overlay-content-padding` for the `content` part (default `var(--lr-space-m)`).
- `lr-context-menu`: `--lr-context-menu-min-inline-size`, which wins over the shared `--lr-overlay-min-inline-size`.
