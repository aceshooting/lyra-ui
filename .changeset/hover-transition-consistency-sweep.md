---
"@aceshooting/lyra-ui": patch
---

Ease hover and press paint consistently across the library. Dozens of components repainted their
background, text or border colour instantly on `:hover`/`:active` while `<lr-button>`,
`<lr-copy-button>` and `<lr-icon-button>` eased theirs over `--lr-transition-fast`, so an interface
mixing them felt inconsistent — a toolbar button would ease while the menu item next to it snapped.

Every affected part now carries the same `--lr-transition-fast` transition on its resting rule. Only
the interpolation changes: resting and hovered colours are untouched, so nothing renders differently
once a transition settles. Parts whose hover state only changes `opacity`, `outline`, `filter`, an
SVG `fill`/`stroke`, or a range input's `accent-color` were deliberately left alone.

This needs no `prefers-reduced-motion` handling of its own: the token layer already collapses
`--lr-transition-fast` to `0.001ms` under that query and applies a blanket near-zero
`transition-duration` across every component's shadow tree.
