---
"@aceshooting/lyra-ui": minor
---

`<lr-popover>` gains a third `popupRole` value, `none`, so the library can express the WAI-ARIA
disclosure-navigation pattern. Previously `popupRole` was `dialog | menu` only, which left a header
nav flyout with no correct option: `menu` announces "menu, menu item" and expects `menuitem`
children, while a navigation flyout is a list of links, and `dialog` implies an interruptive
surface. Consumers had to abandon the library's overlays and hand-roll a
`button[aria-expanded][aria-controls]` plus a plain list.

Under `popup-role="none"` the popup surface renders no `role` and no generated `aria-label`, and
the trigger carries no `aria-haspopup`, so the slotted `<nav>` owns the semantics and the
accessible name. Everything else — `aria-expanded`/`aria-controls`, light dismiss, Escape, focus
return, positioning — is unchanged. Purely additive: `dialog` remains the default, and
`lr-dropdown` still pins its own role to `menu`.
