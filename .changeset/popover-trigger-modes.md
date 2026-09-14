---
'@aceshooting/lyra-ui': minor
---

`<lr-popover>` gains hover, focus and manual trigger modes with delays and a hover bridge

`trigger="click" | "hover" | "focus" | "manual"` selects which interaction opens the surface, and
defaults to `click` — today's behaviour, unchanged for every existing popover.

The two transient modes are built for the cases a click-only surface could not serve:

- `show-delay` and `hide-delay` (both `0` by default) put a grace period around opening and
  closing, so a pointer grazing the trigger does not flash the surface open.
- `hover-bridge` has the positioner clip an invisible quad across the `distance` gap between the
  trigger and the popup, so travelling between them never leaves both at once.
- A hover- or focus-opened surface **never moves focus into itself**, so it cannot take the caret
  from whatever the user is actually typing into.
- Focus resting anywhere inside the surface keeps it open, so a keyboard user can tab from the
  trigger straight into the content.
- Clicking the trigger **pins** a transient surface open; clicking again releases the pin and
  closes it.

`trigger="manual"` refuses every interaction and leaves the surface entirely to
`show()`/`hide()`/`open`. `<lr-dropdown>` inherits the whole contract, menu focus included.
