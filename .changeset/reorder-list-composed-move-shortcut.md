---
"@aceshooting/lyra-ui": patch
---

Fixed `<lr-reorder-list>`'s documented Ctrl/Cmd+ArrowUp/ArrowDown shortcut so it fires from real
keyboard focus on a row's own move button, not only when a `keydown` happens to be dispatched
synthetically on the button's host element. The move buttons are composed `<lr-icon-button>`s, so
real DOM focus during ordinary keyboard use lands on that button's own native `<button>` — one
shadow boundary deeper than `<lr-reorder-item>`'s own shadow root. The exclusion predicate that
tells the row's own chrome apart from a consumer's nested control only recognized an element whose
root node was exactly the item's shadow root, so the nested native button fell through to the
generic `name === 'button'` exclusion and every Ctrl/Cmd+Arrow press starting from real focus on a
move button was discarded as though it had come from a consumer's own control.
