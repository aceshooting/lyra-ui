---
'@aceshooting/lyra-ui': minor
---

`lr-drop-zone` gains `for` (an element id in the zone's own root) and `target` (an element reference, taking precedence). Set either to attach the zone to a region that already exists in the page instead of wrapping it: the zone handles drags over that element, lays its overlay over the element's box, adds no box of its own and still emits `lr-files` from itself. A `for` id that matches nothing binds nothing and is re-resolved when the root's elements or ids change. The new `targeted` custom state matches while a target is bound. Unset, the zone keeps wrapping its default slot as before.
