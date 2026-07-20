---
"@aceshooting/lyra-ui": minor
---

`lr-thread-list` now forwards the row `<lr-conversation-item>`'s own CSS parts out of data mode under
a `row-item-*` namespace: `row-item-base`, `row-item-option`, `row-item-leading`, `row-item-content`,
`row-item-title`, `row-item-title-input`, `row-item-rename-button`, `row-item-excerpt`,
`row-item-meta`, `row-item-timestamp` and `row-item-actions`.

Data mode builds each row itself, two shadow roots down, so until now none of those eleven parts were
reachable from outside — including the two declarations that set row height. Row density could only
be changed with `lr-thread-list::part(row) { --lr-theme-space-s: … }`, a whole-subtree retheme that
also shrank everything nested in the row (a `renderActions` menu's items dropped below the
touch-target floor and had to be un-retheme'd inline). `lr-thread-list::part(row-item-base)
{ padding-block: … }` now sets row density with no token override and no collateral damage.

The existing `row-leading`/`row-content`/`row-meta`/`row-actions`/`row-wrapper` parts are unchanged;
they wrap this component's render-callback output, which is a different surface from the item's own
internals. Purely additive: an unstyled thread list renders identically.
