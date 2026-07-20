---
"@aceshooting/lyra-ui": minor
---

Add component-scoped state-styling cssprops to eight layout/forms components, so a selected/active/current state can be restyled from outside without hijacking a library-wide `--lr-color-*` token (which repaints everything else reading it). `::part(x)[state]` is invalid CSS — an attribute selector cannot follow `::part()` — so hijacking the shared token used to be the only lever. Each new prop is an inline `var()` fallback (never declared on `:host`, which would re-stamp per instance and shadow any ancestor value), and every default is the exact token the rule used before, so an unset consumer renders byte-identically.

- `lr-app-rail-item`: `--lr-app-rail-item-current-bg`, `--lr-app-rail-item-current-color` for the `active`/`aria-current="page"` item.
- `lr-stepper`: `--lr-stepper-current-color`, `--lr-stepper-error-color`, `--lr-stepper-current-index-bg`, `--lr-stepper-current-index-color`.
- `lr-widget`: `--lr-widget-view-toggle-active-bg`, `--lr-widget-view-toggle-active-color` for the pressed view toggle.
- `lr-carousel`: `--lr-carousel-indicator-current-bg`, `--lr-carousel-indicator-current-border-color` for the current slide's indicator dot.
- `lr-breadcrumb-item`: `--lr-breadcrumb-current-color` for the current-page item.
- `lr-command-palette`: `--lr-command-palette-active-bg` for the active command row.
- `lr-time-range`: `--lr-time-range-preset-active-bg`, `--lr-time-range-preset-active-border-color`, `--lr-time-range-preset-active-color` for the active preset button.
- `lr-emoji-picker`: `--lr-emoji-picker-active-bg` for the keyboard-active and hovered emoji (both share one rule, so one hook retints both).
