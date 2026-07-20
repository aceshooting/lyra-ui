---
"@aceshooting/lyra-ui": patch
---

Route several stray hardcoded style values through design tokens so visually-identical states stay
in sync across components:

- **Disabled controls** in `lr-node-palette`, `lr-flow-controls`, `lr-compare-panel`,
  `lr-graph-query-builder`, and `lr-rubric-form` now dim through the shared `--lr-opacity-disabled`
  token instead of one-off `0.4`/`0.5`/`0.6` literals, so every disabled control fades by the same
  amount (and rethemes with one property).
- **Anchored popovers/menus/tooltips** (`lr-menu`, `lr-select`, `lr-combobox`, `lr-date-input`,
  `lr-model-select`, `lr-voice-picker`, `lr-mention-popover`, `lr-export-button`, `lr-tour`,
  `lr-tool-call-chip`, `lr-usage-badge`, `lr-citation-badge`, `lr-entity-chip`,
  `lr-knowledge-graph-explorer`) share a new `--lr-popover-viewport-clamp` token (default `92vw`,
  themeable via `--lr-theme-popover-viewport-clamp`). Previously these split between `92vw` and
  `90vw`, so two popovers side by side could clamp to different widths; they now clamp consistently.
- **Solid-fill hover lift** on `lr-chat-composer`, `lr-tool-approval-dialog`, `lr-message-feedback`,
  `lr-tour`, and `lr-retrieval-search` now shares a new `--lr-hover-brightness` token (default
  `1.08`, themeable via `--lr-theme-hover-brightness`), replacing per-component `filter: brightness()`
  magic numbers. Note `lr-retrieval-search`'s submit button now *brightens* on hover like every other
  brand button, where it previously darkened (`0.92`).
- `lr-calendar`'s narrow-container day-cell floor now references the existing `--lr-size-4rem` token
  instead of a raw `4rem`, matching its wide-container sibling.

Also adds a new consumer override hook: `--lr-responsive-panel-sheet-max-block-size` (default `85dvh`,
falling back to `85vh` where `dvh` is unsupported) lets you set the maximum height of an
`lr-responsive-panel` `variant="bottom-sheet"` overlay, which previously had no override at all.
