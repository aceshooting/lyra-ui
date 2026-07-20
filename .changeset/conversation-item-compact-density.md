---
"@aceshooting/lyra-ui": minor
---

`lr-conversation-item` gains a `compact` density flag

A reflected boolean `compact` (default `false`, matching `lr-empty`'s convention) tightens
`[part='base']`'s padding from `var(--lr-space-s) var(--lr-space-m)` to
`var(--lr-space-xs) var(--lr-space-s)`, its gap from `var(--lr-space-xs)` to `var(--lr-space-2xs)`,
and collapses `[part='content']`'s inter-line gap to `0`. Both tuned values sit behind the new
`--lr-conversation-item-compact-padding` / `--lr-conversation-item-compact-gap` custom properties —
declared as inline `var()` fallbacks at the point of use, never on `:host`, so a surrounding list can
retune every row at once from an ancestor. Unset, a row renders exactly as before.

Nothing else changes. In particular `[part='rename-button']` keeps its
`min-inline-size`/`min-block-size: var(--lr-icon-button-size)` floor under `compact`, so a density
flag can never silently drop a row's icon target below the shared minimum; the excerpt stays visible
(it is already single-line ellipsised and `hidden`-bindable per row) and the excerpt/timestamp font
sizes stay at their existing steps. `:host([compact]) [part='base']` is ordered before
`:host([active]) [part='base']`, which is equal specificity, so an active row keeps its background
and its promoted excerpt/timestamp contrast when both are set.
