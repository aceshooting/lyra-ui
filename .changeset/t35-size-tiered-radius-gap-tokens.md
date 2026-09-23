---
'@aceshooting/lyra-ui': minor
---

`lr-code-editor`, `lr-segmented`, `lr-checkbox`, `lr-progress-bar`, `lr-export-button` and
`lr-combobox` gain dedicated corner-radius (and, for `lr-export-button`, gap) custom properties
for their size-tiered chrome — `--lr-code-editor-radius`, `--lr-segmented-segment-radius`,
`--lr-checkbox-box-radius`, `--lr-progress-track-radius`, `--lr-export-button-gap`/`-radius` and
`--lr-combobox-tag-bg`/`-color`/`-radius` — each defaulting to today's exact rendering, so they are
retunable without a `::part()` rule. `lr-widget`'s collapse and fullscreen buttons now expose their
own `--lr-widget-collapse-button-hover-bg`/`-hover-color` and
`--lr-widget-fullscreen-button-hover-bg`/`-hover-color` hooks, and `lr-select`'s tag remove-button
gains `--lr-select-tag-remove-hover-bg`, so retinting the shared brand tokens for one purpose no
longer silently repaints these unrelated controls.
