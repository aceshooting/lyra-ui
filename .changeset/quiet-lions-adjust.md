---
"@aceshooting/lyra-ui": patch
---

Give `<lr-table>`'s sorted column header an opaque default fill. The header is `position: sticky`
and the sorted-state rule defaulted to `transparent`, so in any height-capped table the body rows
scrolled visibly through the sorted column's header cell.

Give `<lr-pdf-viewer>`'s toolbar buttons a hover fill that differs from the toolbar behind them —
the rule existed but resolved to the toolbar's own opaque token, so hovering produced no visual
change at all. Retunable via the new `--lr-pdf-viewer-toolbar-button-hover-bg`.

Correct three `<lr-chat-message>` snippets in the authored reference that used `role="user"`. The
property reflects to `data-role`, so `role` was never observed: consumers copying those examples
got a message rendered as the default `assistant`, plus an invalid ARIA role token in the DOM.
