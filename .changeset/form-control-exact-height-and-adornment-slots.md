---
"@aceshooting/lyra-ui": minor
---

Form controls: exact-height escape hatches and `start`/`end` adornment slots.

- `--lr-combobox-trigger-height` and `--lr-input-control-height` are new custom properties that pin
  an exact control height — flooring *and* capping the row — so `lr-select`, `lr-combobox` and
  `lr-input` can be pixel-matched in one toolbar without a `::part()` rule. Both are deliberately
  left undeclared by default, so each tier's existing `*-min-height` floor still applies when they
  are unset. Because the component never declares them, they can also be set from an ancestor or an
  outer-tree rule, not only inline on the element. On `lr-combobox` the hatch is a single-row
  affordance: in `multiple` mode a tag row long enough to wrap overflows the pinned box visibly
  (nothing is clipped), so leave it unset there.
- **Behaviour change:** `lr-select` declared `--lr-select-trigger-height: auto` on `:host`, which
  made the `var()` fallback to `--lr-select-trigger-min-height` unreachable and left that property
  dead at the default `m` tier (four extra specificity rules patched the floor back for
  `xs`/`s`/`l`/`xl` only). The sentinel is now genuinely undeclared and the patch rules are gone, so
  `--lr-select-trigger-min-height` is live at every tier. The visible consequence is that a
  default-size `lr-select` trigger now honours the `2.5rem` floor it already declared — byte
  identical to `lr-input`'s and `lr-combobox`'s own `m` floor, so the three controls line up.
  `getComputedStyle(el).getPropertyValue('--lr-select-trigger-height')` now returns `''` rather than
  `'auto'`; assert the rendered `min-block-size`/`block-size` instead.
- `lr-combobox` and `lr-date-input` gain `start`/`end` adornment slots with matching `start`/`end`
  CSS parts, mirroring `lr-input`'s existing implementation: the wrappers are `hidden` while nothing
  is slotted, and they inherit the control's own padding so no consumer spacing is needed. `end`
  renders before the dropdown chevron (`lr-combobox`) and before the calendar toggle
  (`lr-date-input`), so consumer content never sits outboard of the built-in trigger. Slotted
  adornments are never collected as `lr-combobox` options.
- `lr-select` is deliberately excluded from `start`/`end`: its `[part='trigger']` is a native
  `<button>`, whose content model forbids interactive descendants, and its `justify-content:
  space-between` would push the label to the middle. `lr-date-input` is deliberately excluded from
  the exact-height hatch: its row has no `min-block-size`, and its height is pinned transitively by
  `--lr-icon-button-size` on the calendar button — capping it would crush the 24x24 target.
