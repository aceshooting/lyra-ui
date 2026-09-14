---
"@aceshooting/lyra-ui": minor
---

`<lr-app-rail>` now projects its mobile overlay's disclosure state onto the external element
`trigger`/`for` resolves.

Wiring a hamburger button in application chrome to the rail already returned focus to it on every
close path, but the button itself announced nothing: it carried no `aria-expanded` and no
`aria-controls`, so a screen-reader user operating it could not tell whether the navigation was
open or what it controlled. The resolved trigger now receives both, through the same shared ARIA
ownership `<lr-popover>` uses for its own trigger — including the element-reference form that
crosses the shadow boundary an `aria-controls` idref cannot, and including restoring whatever the
consumer had written itself once the association is released. `aria-expanded` renders in both
states, never only when open.

The association applies while the rail is in `'mobile'` mode and is released when it leaves that
mode or disconnects: outside mobile there is no overlay to expand, and a permanent
`aria-expanded="false"` would announce a disclosure that does not exist. Unlike the focus-return
association (resolved once, when the overlay opens), this tracks live — reassigning `trigger` moves
the state to the new element and clears it from the old one.
