---
"@aceshooting/lyra-ui": patch
---

`lr-menu`: axe coverage for a composed popup, stories moved onto the new `header`/`footer` slots,
and the three shipped descriptions of what this component accepts finally agree.

- New axe assertion for a menu with a `header` `<input>` and a `footer` `<button>` — the exact shape
  that was an `aria-required-children` violation while the only place for it was inside
  `role="menu"`, and which no test covered.
- `show() / hide({ focusTrigger: true })`'s Apply button moves to `slot="footer"`, and the filter
  field gets a new `header`-slot story. The old default-slot filter story stays, relabelled as the
  legacy shape it now is, so its `closeOnEscapeAnywhere` behavior remains covered.
- The class doc's `@slot` tag said "menu items and `<hr>` only" while the interaction contract two
  paragraphs above it promised slotted controls "keep their own full default keyboard behavior" and
  `show()`/`hide()` named a slotted Apply button as a supported case. All three now describe the
  same component.
