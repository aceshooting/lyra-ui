---
"@aceshooting/lyra-ui": minor
---

`<lr-app-rail-item>` gains `meta` and `end` slots, and a new `<lr-app-rail-group>` component titles
and optionally collapses a section of rail items.

Both new item slots render as SIBLINGS of the item's own link/button — the shape `<lr-details>`
already uses for its `header-actions` — never inside it. A control slotted into `end` (an overflow
menu trigger, a dismiss button) therefore keeps its own click, keyboard activation and focus order
instead of being swallowed by the item's activation target, and neither slot's text joins the
item's accessible name. `meta` carries secondary text such as an unread count and is visually
clipped in `icon-only` mode exactly as `[part="label"]` is, staying available to assistive
technology; `end` stays visible there. Both wrappers (`[part="meta"]`, `[part="end"]`) are hidden
while empty, so an item using neither renders as it did before. `--lr-app-rail-item-meta-color` and
`--lr-app-rail-item-meta-font-size` retune the metadata text, and
`--lr-app-rail-item-gap` now also spaces the item's control from its adornments.

`<lr-app-rail-group>` groups items by composition — it holds whatever it is given, with no items
array and no renderer callback, so it can never disagree with what is rendered inside it. It names
itself with a real heading landmark (`role="heading"` plus a settable, range-clamped
`heading-level`, rather than a hard-wired `<h3>` whose level would be wrong in half the pages that
embed a rail) and labels its own `role="group"` container from that heading. `collapsible` opts in
the standard disclosure shape: the heading's own text becomes the button carrying `aria-expanded`
and `aria-controls`, and collapsing runs through a `lr-toggle-request` / `lr-toggle` request/commit
pair, so a consumer can veto it or resolve it by assigning `open` from the request listener.
`open` defaults to `true` and accepts `open="false"` from markup. A `header-actions` slot places
controls beside the heading without toggling the group.

The rail marks a slotted group `icon-only` the same way it marks a slotted item, and the group
forwards that to the items it owns — including items appended later — so grouping survives the
rail's icon-only presentation.
