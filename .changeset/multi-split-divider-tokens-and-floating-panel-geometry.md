---
"@aceshooting/lyra-ui": minor
---

`<lr-multi-split>`: divider theming hooks, and two floating-panel geometry defects fixed.

- Divider hairline color is now themeable: `--lr-multi-split-divider-color` (resting, default
  `var(--lr-color-border)`), `--lr-multi-split-divider-hover-color` (default
  `var(--lr-color-brand)`), and `--lr-multi-split-divider-active-color` (default the existing
  pressed `color-mix()`). A new `--lr-multi-split-divider-thickness` (default `var(--lr-size-3px)`)
  separates the painted hairline's width from `--lr-multi-split-divider-target-size`, so either can
  be tuned without affecting the other — retuning the paint thickness alone can never shrink the
  WCAG 2.5.8 pointer target, which stays governed solely by `--lr-multi-split-divider-target-size`.
  All four are byte-identical when unset.
- The `'floating'` collapse state's closed drawer (`panel.hidden = true`) had no `[hidden]` rule in
  the component's own stylesheet, so an ordinary (non-`!important`) author `display` rule targeting
  the panel directly silently re-showed it despite `hidden` being set. `::slotted([hidden])` now
  restates `display: none` with the `!important` this specific defect requires: per CSS Cascade 5's
  shadow-tree encapsulation-context ordering, a normal-weight rule in the slotted element's own
  (light-DOM) tree can already outrank a same-specificity `::slotted()` rule in this shadow tree, so
  only `!important` reliably wins back the panel's actually-hidden state for every author
  specificity, not just some.
- `::slotted(*)` gains `box-sizing: border-box`, since it does not inherit across the slot boundary;
  a slotted panel with its own padding/border no longer overflows the percent/flex-basis allocation
  computed for it.
- The `'floating'` overlay card's `inline-size` (mirroring its own live `sizes[i]` percent) is now
  written as `var(--lr-multi-split-floating-panel-inline-size, ${percent}%)` instead of a bare
  literal, so a consumer can override the geometry through that custom property at ordinary
  specificity instead of needing `!important` against an inline style rewritten on every render.
  Unset, the rendered geometry is identical to before.

The floating panel's `position`/`inset-block`/`inset-inline-*` were already moved to ordinary,
`!important`-free stylesheet rules in a prior change (see `multi-split.class.ts`'s comment above
`OWNED_PANEL_STYLE_PROPERTIES` and the corresponding `::slotted([data-collapse-state='floating'])`
rule in `multi-split.styles.ts`) and needed no further change here.
