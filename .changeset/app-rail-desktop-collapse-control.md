---
"@aceshooting/lyra-ui": minor
---

`<lr-app-rail>` gains an opt-in desktop collapse control and a `toggleCollapse()` method.

Setting `collapsible` renders a `[part="collapse-toggle"]` button inside `[part="header"]` that
flips the rail between its `'full'` and `'icon-only'` presentations. It carries a localized
accessible name (`appRailCollapse` / `appRailExpand`, both new `DEFAULT_STRINGS` keys translated in
all ten shipped catalogs) and renders `aria-expanded` in both states, so a screen reader announces
which presentation the rail is in rather than only the button's label. Its chevron is
direction-aware through the new `[part="collapse-icon"]` wrapper's own `transform` — one glyph,
mirrored by the wrapper, under both `dir` values. Four hooks retune it:
`--lr-app-rail-collapse-toggle-hover-bg`, `--lr-app-rail-collapse-toggle-hover-color`,
`--lr-app-rail-collapse-toggle-active-bg` and `--lr-app-rail-collapse-toggle-active-color`.

`toggleCollapse()` performs the same flip for a consumer that renders its own control — in app
chrome, a command palette, a keyboard shortcut — instead of, or alongside, opting into
`collapsible`. Both write `preferredMode`, never `forceMode`, so the `mobile-breakpoint` keeps
being tracked automatically (a genuinely too-narrow viewport still wins), the change announces
itself through the existing `lr-mode-change` event, and it survives a reload whenever `storage-key`
is set and `persist` includes `preferred-mode`.

Both are inert in `'mobile'` mode: the control is not rendered at all (a second, meaningless
control inside the focus-trapped overlay next to the dismiss button), and `toggleCollapse()`
returns without recording a preference the user never chose. `collapsible` defaults to `false`,
where the rail renders exactly as before — no extra element, and `[part="header"]`'s original block
layout unchanged.
