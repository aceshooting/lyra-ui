---
"@aceshooting/lyra-ui": minor
---

Add missing CSS custom-property hooks and paint transitions across six components. Every new
hook's fallback reproduces the exact rendering that shipped before, so nothing changes visually
until a consumer sets one.

- layout/menu-item: `<lr-menu-item type="checkbox" checked>` gained checked-row chrome hooks
  (`--lr-menu-item-checked-bg`/`--lr-menu-item-checked-color`/`--lr-menu-item-checked-font-weight`),
  matching the checked/selected-state hooks `<lr-option>`, `<lr-select>`, `<lr-combobox>`, and
  `<lr-tree-item>` already expose. Defaults to transparent/inherit/inherit, so an existing checked
  row is unchanged.
- data/context-meter: `[part="track"]`'s block size, corner radius and background, and the
  hairline seam painted between adjacent bar-shape segments, were fixed to shared global tokens
  with no component-level override. They're now retunable via `--lr-context-meter-track-size`,
  `--lr-context-meter-track-radius`, `--lr-context-meter-track-bg`, and
  `--lr-context-meter-segment-seam-color`.
- data/stat: introduced `--lr-stat-padding` and `--lr-stat-gap`, read by `::part(base)` in every
  rendering path — the default card, `compact`, `frame="plain"`, and (previously unreachable) the
  linked-card's internal `.linked-content` wrapper. A `href`-linked stat's padding/gap no longer
  goes inert against a `::part(base)` override: both the anchor and its content wrapper now read
  the same tokens.
- layout/details: `--lr-details-spacing` alone used to drive the summary's and the panel content's
  padding on every axis. It's now joined by four independently-settable hooks —
  `--lr-details-summary-padding-block`, `--lr-details-summary-padding-inline`,
  `--lr-details-content-padding-block-end`, and `--lr-details-content-padding-inline` — mirroring
  how `--lr-details-gap` and `--lr-details-radius` are already independent of each other. Each
  falls through to `--lr-details-spacing` (and, above that, the upstream `--spacing` compatibility
  hook) when unset.
- layout/control-group: `[part="base"]`'s `inline-size: 100%` previously only applied inside a
  `responsive`-gated `@container` narrow-allocation breakpoint, so a control group given a
  definite width by its host could still render shrink-wrapped. The fill is now unconditional,
  matching the established fill-chain pattern used elsewhere in the library (e.g.
  `<lr-file-input>`): a percentage inline-size against an indefinite/shrink-to-fit containing
  block resolves as `auto` per the flex sizing algorithm, so a toolbar with no explicit host width
  renders exactly as before.
- forms/icon-button, layout/app-rail-item: hover/press background (and, for the icon button,
  border and foreground) now transition over `--lr-transition-fast`, matching `<lr-button>` and
  `<lr-copy-button>`'s existing paint transitions. `--lr-transition-fast` already collapses to a
  near-zero duration under `prefers-reduced-motion` at the shared token layer, so no additional
  media query was needed.
