---
"@aceshooting/lyra-ui": patch
---

`<lr-typing-indicator>`: the visible `part="label"` rendered by `label-placement="after"` is now
`aria-hidden="true"`, matching `<lr-gauge>`'s own `part="label"` treatment. The host's `aria-label`
already carries the identical string as this component's accessible name, so the visible copy was
reachable a second time as its own accessibility-tree node for the same text; it is now purely
decorative, as `<lr-spinner>`'s equivalent default-slot label already effectively is (there the
slotted content is the one and only source of the name, so no duplicate node exists). No visual
change, and `label-placement="none"`'s screen-reader-only rendering is unaffected.
