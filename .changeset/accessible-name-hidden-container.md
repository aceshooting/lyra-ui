---
"@aceshooting/lyra-ui": patch
---

Keep accessible names computed from slotted content independent of whether the component is
currently displayed. A row inside a closed dropdown, a tab in a hidden group, or a chip, tag, toast
or progress bar inside any `visibility: hidden` container previously computed an empty name, because
the shared accessible-text walk applied visibility inherited from the container to the content it
was naming.

`lr-menu-item` and `lr-dropdown-item` additionally wrote that empty result back as an authoritative
`aria-label=""`, which suppresses the row's own content-derived name and left it permanently
unnamed — most visibly on a dropdown that is already `open` on its first render. An empty computed
name now removes the attribute instead of emptying it, for both the row and its submenu's
`role="menu"`, so the browser falls back to the visible label. `getTextLabel()` returns that label
for a closed menu too, restoring type-ahead.

`lr-tag` also never named its remove button from an element-wrapped label, because its first sample
runs before layout exists; it now takes the same pre-layout reading `lr-chip` already did.

Authored `aria-label`, `aria-labelledby` and explicitly empty consumer labels stay authoritative,
and `display: none`, `aria-hidden`, `inert` and `hidden` branches are still excluded from every
computed name.
