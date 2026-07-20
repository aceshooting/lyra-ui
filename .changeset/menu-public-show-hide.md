---
"@aceshooting/lyra-ui": minor
---

`lr-menu`: `show(focus?)` and `hide(options?)` are now public.

- `hide({ focusTrigger: true })` closes the menu **and** returns DOM focus to the `trigger`-slotted
  element — the case the trigger alone cannot express, e.g. a slotted "Apply"/"Done" button inside
  the menu, or a consumer-owned keyboard shortcut. `hide()` on its own closes without moving focus,
  for dismissals where the interaction has already put focus somewhere the user chose.
- `show()` is promoted alongside it (rather than shipping an asymmetric API) and still accepts the
  `'first' | 'last'` initial focus target.
- The roving-tabindex reset moved from `hide()` into `updated()`, so a bare `el.open = false` from
  outside now resets `activeIndex` too. Previously that path left a stale `tabindex="0"` tab stop on
  whichever item was last active, so Tab could land inside a closed menu. `hide()` stays thin and
  `updated()` remains the single owner of positioning, listeners and the `lr-show`/`lr-hide` events;
  focus restoration deliberately stays in `hide()` so `disconnectedCallback()`'s own `open = false`
  teardown reset can never steal focus.
