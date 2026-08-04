---
"@aceshooting/lyra-ui": patch
---

Fix `lr-table` rows and `lr-tree-item` where hovering an already-selected row/item had no visible
effect. The `:hover` rule and the selected-state resting rule both resolved to the same
`--lr-color-brand-quiet` fallback at equal CSS specificity (and, for `lr-tree-item`, the
`:host([aria-selected='true'])`-scoped selected rule outranked a bare `[part='row']:hover`
outright), so the selected rule always won and hovering produced no change. Mirrors the fix already
applied to these same files' `:active`-while-selected rules: the hover rule now also matches through
the same specificity-matching selector arm (source order deciding the tie), and its resting fill is
a distinct `color-mix()` step (using `--lr-color-mix-hover`) instead of the plain `brand-quiet`
fallback, so hovering a selected row/item is visually distinguishable from its resting state.
