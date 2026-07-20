---
"@aceshooting/lyra-ui": minor
---

`lr-menu`: new `header` and `footer` slots for composed, non-menu-item content, rendered inside
`[part='popup']` but **outside** the `role="menu"` list — with matching `header`/`footer` CSS parts.

A filter field, a section title, an "Apply"/"Done" button and friends have always been a real use
case for this component (`closeOnEscapeAnywhere` exists for exactly that), but the only place to put
them was the default slot — i.e. inside `role="menu"`, where ARIA permits only
`menuitem`/`menuitemradio`/`menuitemcheckbox`/`group`/`separator` children. Anything else there is an
`aria-required-children` violation. The new slots give that content a valid home.

- Nothing about the default slot changes: item discovery, roving tabindex, type-ahead,
  `closeOnEscapeAnywhere` and its `false` default all behave exactly as before, and `items` still
  only ever contains `<lr-menu-item>`s no matter what the new slots hold.
- With neither slot filled the rendered result is unchanged — both wrappers collapse to no box at
  all, `[part='list']` keeps its exact position and size inside the popup, and the host gains no
  attribute of any kind.
- Emptiness is tracked from each slot's own `slotchange` (reflected as `data-has-header` /
  `data-has-footer` / `data-list-empty` on the host) rather than with `:empty`, which can never match
  a part that contains a slot: Chromium counts the whitespace-only text nodes Lit leaves there.
- Non-item content in the **default** slot keeps working exactly as it did, with no runtime warning,
  but the new slots are now the supported place for it.
