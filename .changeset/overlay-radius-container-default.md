---
'@aceshooting/lyra-ui': major
---

`--lr-overlay-radius` now defaults to `var(--lr-radius-container)` on every floating surface, as the
shared overlay surface already resolved it. The fallbacks that still read `var(--lr-radius)` follow:
the `lr-drawer` `floating` panel, the `lr-dialog` (and so `lr-drawer`) close button, the
`lr-time-input` popup and `lr-toast-item` (whose `--lr-toast-item-radius` default is documented as
`var(--lr-radius-container)` too). The documented default changes on every tag that listed
`var(--lr-radius)`. Nothing changes unless a theme sets `--lr-theme-border-radius-container`, which
these surfaces now follow. Migration: to keep the previous corners under such a theme, set
`--lr-overlay-radius: var(--lr-radius)` (or the component's own radius hook) on the affected
surfaces or an ancestor. `lr-tooltip` keeps `var(--lr-radius-xs)`; `lr-color-picker`,
`lr-locale-picker`, `lr-model-select` and `lr-voice-picker` popups keep following their own
component radius while `--lr-overlay-radius` is unset.
