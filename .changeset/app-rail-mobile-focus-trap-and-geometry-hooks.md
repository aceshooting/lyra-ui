---
"@aceshooting/lyra-ui": minor
---

`<lr-app-rail>`/`<lr-app-rail-item>`: mobile overlay focus-trap fix, external trigger association, and new geometry/theming hooks.

- **Fix:** in mobile mode, `[part="toggle"]` is now reparented to be the first child of
  `[part="panel"]` for exactly as long as the overlay is open, mirroring how `<lr-dialog>` keeps
  its close button inside its own panel. Previously it rendered as a DOM sibling ahead of the
  panel, so while the overlay was open it stayed visible and clickable but was outside both the
  `aria-modal` subtree and the shared focus trap's Tab cycle — reachable by mouse, unreachable by
  keyboard. The same button (never destroyed/recreated) moves back to its resting position, a
  sibling ahead of the panel, once closed, and is rendered as its own reserved row ahead of the
  `header` slot rather than absolutely overlaid on top of it, so a wide/slotted header is never
  obscured.
- **New:** `trigger`/`for` properties associate this rail with an external open control (e.g. an
  application-chrome hamburger button used together with `hide-toggle`). Closing the overlay by
  any path — Escape, backdrop click, a nav-item click, or the built-in toggle — now returns focus
  to that external trigger, instead of relying on whichever element happened to still hold focus.
  `hide-toggle` now only suppresses the toggle in its outside/closed ("open") position; it stays
  visible once reparented inside the open panel, since it is then the only in-panel dismiss
  control — previously `hide-toggle` left an open mobile panel with no in-panel way to close it at
  all besides Escape/backdrop.
- **New tokens**, all byte-identical when unset: `--lr-app-rail-panel-inset-block-start` (applied
  to both `[part="panel"]` and `[part="backdrop"]`, for a fixed app bar/status area above the
  drawer), `--lr-app-rail-panel-radius`, `--lr-app-rail-panel-overflow-inline`/
  `--lr-app-rail-panel-overflow-block` (the panel's `overflow-inline: clip`/`overflow-block: auto`
  also clip a `position: fixed` popup opened by a slotted/nav-item control whose rendered box
  extends past the panel; setting both tokens to `visible` together opts out — per the CSS
  overflow spec a lone `visible` axis paired with a non-`visible` one computes as `auto` instead,
  which still clips, so only one of the two tokens is not enough), `--lr-app-rail-background`,
  `--lr-app-rail-panel-background`, `--lr-app-rail-header-padding`, and
  `--lr-app-rail-footer-padding`.
- **New on `<lr-app-rail-item>`:** `--lr-app-rail-item-min-block-size` (floor-clamped to
  `--lr-icon-button-size`, preserving the WCAG 2.5.8 hit-area minimum regardless of the override),
  `--lr-app-rail-item-padding`, `--lr-app-rail-item-gap`, and `--lr-app-rail-item-icon-size`, plus
  a `[part="current-indicator"]` rendered only while the item is `current`/`aria-current="page"`,
  mirroring `<lr-conversation-item>`'s shipped `active-indicator` part and its
  `--lr-app-rail-item-current-indicator-color`/`-width`/`-inset-inline` tokens.
