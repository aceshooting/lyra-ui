---
"@aceshooting/lyra-ui": patch
---

Two dev-mode defects that shipped in 9.x, plus the per-point chart color cost behind them.

**The unknown-attribute diagnostic no longer reports a component's own API as a mistake.**
Components can now declare a `knownUnobservedAttributes` static for attributes they own without
observing, and four do. Without it the diagnostic fired on correct markup and on state components
set on themselves:

- `<lr-page disable-sticky="header">` is documented public API read only by
  `:host([disable-sticky~="..."])` rules, so it has no reactive property — authoring it correctly
  drew a warning saying it was wrong.
- `<lr-animated-image>` (`playing`), `<lr-menu-item>` (`submenu-open`) and `<lr-app-rail>`
  (`mode`, `dragging`) reflect read-only state onto their own host. Each reported its own output
  as an unknown attribute, in every consumer app, the moment that state turned on.

**Per-point chart colors are resolved once per distinct color, not once per point.**
`resolveCanvasColor` inserts a probe element and forces a synchronous style recalculation on every
call, which `<lr-chart>` paid for each entry of a series' `color`, `segmentColors` and
`pointColors` arrays — 2,000 probe insertions for a 2,000-point series, before drawing anything.
The new `resolveCanvasColors` memoizes by color string across the batch, and authored ramps are
typically a handful of distinct colors repeated across many points. The cache lives for one call,
so a later draw still picks up live `--lr-*` theme changes.

**`<lr-tooltip>` no longer schedules a wasted second render on close.** Its `anchorPositioned`
reset moved from `updated()` to `willUpdate()`, where it belongs — nothing visible changes, since
that render already hides the popup via `open`.
