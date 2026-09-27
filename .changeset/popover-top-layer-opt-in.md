---
"@aceshooting/lyra-ui": minor
---

`lr-popover` gains an opt-in `topLayer` property (attribute `top-layer`, reflected), which `lr-dropdown` inherits. It always shows the open popup in the browser top layer where the native Popover API exists. This fixes a popover inside a fixed or sticky header, toolbar or rail that has its own `z-index`, such as a `position: fixed` header at `z-index: 1000`, when a sibling surface at `z-index: 1100` covers it. That header is only a stacking context, not a containing block. The automatic top-layer escape for `fixed` surfaces therefore never applied, and no `z-index` on the popup could lift it out of the header's context.

While `top-layer` is set, the popup is placed with the `fixed` strategy whatever `positioning-strategy` or `hoist` say, and those properties still read back their own values. No DOM node moves, so the following keep working:

- anchoring, the arrow and RTL placement
- focus, Escape and light dismiss
- the hover bridge, which is promoted with the popup
- submenus
- the show/hide transition

The popup stays promoted through its hide transition and leaves the top layer once it settles closed. Changes apply live while the popover is open. Without native Popover API support, the popup keeps its ordinary `z-index` stacking.

Stacking contexts are deliberately not detected automatically. Every fixed or sticky ancestor creates one, as does almost every `z-index`ed, translucent or isolated one, and promoting through each would override layer ordering that pages set on purpose. Unset, nothing changes.
