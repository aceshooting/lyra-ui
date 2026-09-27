---
"@aceshooting/lyra-ui": minor
---

A row menu that `lr-thread-list`'s `renderActions` opens now keeps its row in the hover state while the menu is open. The menu opens into the browser top layer, where Chromium and WebKit stop matching `:hover` and `:focus-within` on the row once the pointer or keyboard focus moves into the menu. A menu trigger revealed on row hover or focus therefore disappeared while its own menu was open, and if the reveal used `display`, the menu disappeared with it. While the menu is open, the row now carries a new `row-item-base-menu-open` part and keeps its hover tint. A hover or focus reveal can key on that part too (see the `lr-thread-list` docs for the CSS). `lr-conversation-item` exposes the same state as `:state(menu-open)` and a `base-menu-open` part for a menu opened from its `actions` slot. This covers `lr-dropdown`, `lr-popover` and `lr-context-menu`.

Arrow, Home and End keys that a control inside a thread-list row has already handled no longer also move focus to another row. Before, ArrowDown in an open row menu jumped to the next conversation instead of the next menu item.

`lr-flow-node`'s hover-revealed toolbar and `lr-message-actions` with `reveal-on-interaction` also stay visible while a menu opened from them is open. Before, they hid the trigger of that open menu.
