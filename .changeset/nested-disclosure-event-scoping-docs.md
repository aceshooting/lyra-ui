---
"@aceshooting/lyra-ui": patch
---

Document that a nested `<lr-details>` or `<lr-accordion>` does not scope its events to itself, so a
listener on an outer instance must filter by target.

Every event both components emit bubbles and is composed, and that is deliberate — non-bubbling
disclosure events would be a breaking change, and `event.target`/`event.currentTarget` already tell
an inner instance from an outer one. What was missing was saying so where consumers read the API:

- `<lr-details>`: the class documentation now carries the nested-disclosure example and the
  `event.target !== event.currentTarget` guard, matching the note `<lr-dialog>` already ships for
  `lr-close`. A `<lr-details>` nested in another one — in the default panel or in `header-actions` —
  sends its `lr-show`, `lr-hide`, `lr-toggle`, `lr-after-show` and `lr-after-hide` straight through
  the outer panel, where an inner disclosure opening otherwise looks identical to the outer one
  opening.
- `<lr-accordion>`: the same gap existed for nested groups, and it bites harder there, because
  `lr-expand`/`lr-collapse`/`lr-toggle-request`/`lr-after-expand`/`lr-after-collapse` carry a
  `detail.item` belonging to the inner group. An unguarded outer handler that looks that item up
  among its own children finds nothing, or acts on a panel it does not own. Coordination itself was
  always scoped — an outer group never applies its single-panel invariant, roving keyboard model, or
  lifecycle to an inner group's items — so only the listener ever needed the guard.

Each individually affected event also carries a one-line pointer back to that guard, the shape
`<lr-dialog>` already uses on `lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide`: a consumer reading
only the entry for `lr-show`, `lr-after-hide`, `lr-expand` or `lr-after-collapse` now sees the filter
without having to find the longer note under a different event.

No runtime behaviour changed in either component; both now have a regression test asserting a nested
instance's events reach an outer listener and that the documented target filter separates the two.
`<lr-details>` additionally gained a test pinning that a vetoed `lr-hide` announces neither
`lr-toggle` nor `lr-after-hide` and still settles its `hide()` promise.
