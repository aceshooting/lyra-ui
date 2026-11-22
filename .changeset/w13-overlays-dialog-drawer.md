---
'@aceshooting/lyra-ui': minor
---

`lr-dialog` and `lr-drawer` sizing and panel hooks, each off or defaulting to the current rendering:

- `lr-dialog`: a `fullscreen-narrow` attribute that fills the viewport while it is at most `40rem` wide (followed live); `--lr-dialog-max-height` (panel block-size cap, viewport-capped); `--lr-dialog-viewport-inset` (gap between the viewport and the panel, default `var(--lr-space-l)`); `--lr-dialog-panel-bg` (fill of the panel only, so popups opened inside keep `--lr-overlay-surface`); and `--lr-dialog-divider-color` (header and footer rules, default the `--lr-overlay-border` chain).
- `lr-drawer`: `--lr-drawer-panel-bg` (panel-only fill, ahead of `--lr-dialog-panel-bg`); a `floating` attribute for an inset sheet with a `--lr-drawer-inset` gap (default `var(--lr-space-s)`) and corners rounded with `--lr-overlay-radius`; and `--lr-drawer-radius`. The default drawer stays square and edge-flush.
