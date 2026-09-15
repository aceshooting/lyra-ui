---
"@aceshooting/lyra-ui": minor
---

`<lr-menu-item>` (and `<lr-dropdown-item>`, which inherits it) gains `type="radio"`, rendering
`role="menuitemradio"` with exclusive-choice group semantics, alongside the existing
`type="checkbox"`.

Activating an unchecked radio row fires the same cancelable `lr-menu-item-change` proposal
`type="checkbox"` already uses (`detail: { value, checked: true }`); once not prevented, the row
becomes `checked` and every other `type="radio"` row the *same owning `<lr-menu>`* owns directly is
unchecked, enforcing a single current choice. Activating an already-checked radio is a no-op on
`checked` — no proposal, no state change — matching native `<input type="radio">` semantics, though
selection still proceeds through the owning menu exactly like re-activating any other item. A new
`group` attribute narrows that exclusive scope to only the radio rows sharing the same string, so
one menu can host several independent single-choice sections; left unset, the scope defaults to
every radio row the menu owns directly (a nested submenu's radio rows already belong to that
submenu's own owning menu, so they were never in the outer scope regardless of `group`). The
checkmark glyph and `[part="checkmark"]`/`[part="checked-icon"]` are reused as-is from
`type="checkbox"`.

Previously `<lr-menu>` had no way to model an exclusive
choice (Sort by…, Theme, Currency, Units) without hand-building it from `type="checkbox"` rows plus
a `preventDefault()` veto on every `checked: false` proposal, re-driving `checked` from application
state — and assistive technology announcing the result as N independent checkboxes rather than one
single-choice group. An out-of-vocabulary `type="radio"` previously degraded silently to a plain
`role="menuitem"` with no `aria-checked` and no checkmark; it is now a fully supported value.

Sibling sweep: no other component declares a `'normal' | 'checkbox'`-shaped type union or branches
on `.type === 'checkbox'` outside this one, and `<lr-menu-item>` is the only implementer of the
internal item-to-menu ownership contract this feature extends. The shared `menuitemradio`-aware
internals (`internal/focus-navigation.ts`'s navigable-role list and
`internal/form-control-labels.ts`'s label-click activation) already included `menuitemradio`
ahead of this change, so no further wiring was needed there. `<lr-data-grid>`'s and
`<lr-filter-bar>`'s own `role="menuitemcheckbox"` rows (column visibility, `'checkbox-menu'`
filters) are genuine multi-select use cases, not exclusive choice, and are unaffected.
