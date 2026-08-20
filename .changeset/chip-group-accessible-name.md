---
"@aceshooting/lyra-ui": minor
---

`<lr-chip-group>` gained `accessibleLabel` (attribute `aria-label`) and now renders
`role="group"` on `[part='base']` whenever a name is supplied.

A chip group is a group, and every peer grouping primitive in this library already said so —
`<lr-radio-group>` renders `role="radiogroup"`, `<lr-segmented>` the same, each forwarding a host
`aria-label` inward to the element that owns the role. `<lr-chip-group>` rendered a roleless
container and read no accessible name at all. Because a host `aria-label` does not cross a shadow
boundary, a consumer labelling the host named nothing: the chips were announced as unrelated
toggle buttons with no indication of what set they belonged to.

This surfaced from a real multi-select filter row, where the consumer had to hand-write
`role="group" aria-label="…"` onto the host to get a named group. That workaround is the evidence
the capability was wanted and was reachable only by reaching around the component.

The role is applied only *with* a name, deliberately. An unnamed group role adds verbosity without
adding information, and applying it unconditionally would change the accessibility tree of every
decorative chip row already shipped. An explicit unset-regression test pins that.
