---
"@aceshooting/lyra-ui": minor
---

`lr-card`: `interactive` now grants real activation semantics when `href` is not also set.
`[part='base']` becomes focusable (`tabindex="0"`), responds to Enter and Space (Space calls
`preventDefault()` so the page does not scroll under the focused card), and emits a new
`lr-card-activate` event (no detail) — so a clickable tile no longer needs a consumer-supplied
wrapper or a `::part(base)` hack to be keyboard-operable.

- The card deliberately carries **no** `role="button"`. A card is a container that routinely holds
  slotted buttons and links, and `role="button"` around focusable descendants is the axe-core
  `nested-interactive` violation this library's own a11y gate enforces (unlike `lr-chip`'s
  `toggleable` mode, which can forbid focusable children and therefore can carry the role).
- Because of that, "did the user aim at the card or at a control inside it?" is answered at event
  time: the handler walks `composedPath()` from the original target up to `[part='base']` and bails
  out if anything on the way is itself a control (a link, button, form control, `[tabindex]`, or an
  interactive `role`). A click on a slotted `lr-button` or `<a>` therefore never activates the card.
- With `href` set, the root is still a real `<a>`: native navigation remains the activation, no
  extra `tabindex` is added, and `lr-card-activate` is never fired.
- Without `interactive`, the rendered output is unchanged — no `tabindex`, no listeners, no events.
