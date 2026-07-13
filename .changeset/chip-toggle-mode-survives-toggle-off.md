---
"@aceshooting/lyra-ui": minor
---

Fixed `lyra-chip`'s opt-in `selected` toggle/pressed mode so it stays interactive after the first
click. `[part='base']`'s `role="button"`, `tabindex`, `aria-pressed`, and click/keydown handlers
used to be gated on the *current* value of `selected`, so a chip that started `selected` and was
clicked (flipping it to `false`) lost its focusable/clickable semantics on the next render — there
was no way to click it back on. `selected` becoming `true` at any point now latches the chip into
toggle mode for good, so it stays clickable in both directions. A chip that must be interactive
from the outset while starting **unselected** (e.g. an initially-inactive filter chip) can opt in
explicitly with the new `toggleable` property, since `selected`'s own default (`false`) can't be
told apart from "never opted in" on its own.
