---
"@aceshooting/lyra-ui": minor
---

`<lr-app-rail-item>` gains its own expandable child list — the treeitem-with-link pattern used by
repository trees, Notion-style page trees and IDE explorers, where the row itself navigates and a
separate disclosure expands that item's own nested rows. Nested `<lr-app-rail-item>`s slotted into
`children` grow a built-in disclosure (`[part="toggle"]`) as a SIBLING of the item's own
link/button, never nested inside it, so the link keeps navigating on its own and the disclosure
keeps toggling on its own. The new `expanded` property (reflected, `false` by default) is driven
through a cancelable `lr-toggle-request`/settled `lr-toggle` pair, mirroring
`<lr-app-rail-group>`'s collapsible contract exactly (same event names, same `{ open }` detail
shape, same request/commit veto semantics). The disclosure carries `aria-expanded` and
`aria-controls`, and a localized accessible name interpolating the item's own label. `icon-only`
forwards from an item onto every `<lr-app-rail-item>` it owns through `children`, exactly how
`<lr-app-rail-group>` forwards onto the items and groups it owns; a new
`--lr-app-rail-item-indent` token (default `var(--lr-space-l)`) indents `[part="children"]` once
per nesting level. An item with nothing slotted into `children` renders no disclosure and no
`[part="children"]` at all — byte-identical to an item authored before this feature existed.
